// ============================================================
// GAME — state machine + main loop.
// Ties all systems together. No game logic lives here directly.
// ============================================================

import { CONFIG }         from './config.js';
import { BALANCE }        from './balance.js';
import { Input }          from './input.js';
import { Juice }          from './juice.js';
import { Renderer, LightningVFX, IceVFX } from './renderer.js';
import { Player, Bullet, Orb } from './entities.js';
import { Modifier }            from './utils.js';
import {
  createWorld, calculateDifficulty,
  SpawnerSystem, MovementSystem, CollisionSystem,
  AbilitySystem, handleKill, UpgradeSystem,
}                         from './systems.js';
import {
  MainMenuUI, ElementSelectorUI,
  WaveHubUI,
  GameOverUI, PauseUI, InfoMenuUI, LevelUpUI,
}                         from './ui.js';
import { SkillEffects }   from './components.js';
import { Audio }          from './audio.js';

// ---- Game state enum ----
const State = {
  MAIN_MENU:       'main_menu',
  ELEMENT_SELECT:  'element_select',
  PLAYING:         'playing',
  PAUSED:          'paused',
  HUB:             'hub',
  WAVE_TRANSITION: 'wave_transition',
  GAME_OVER:       'game_over',
};

export const Game = {
  state:             State.MAIN_MENU,
  player:            null,
  world:             null,
  _lastTime:         0,
  _fireTimer:        0,
  _transitionTimer:  0,
  _waveStats:        null,
  _waveStartKills:   0,
  _waveStartGold:    0,
  _waveStartLevel:   1,
  _debugMode:        false,

  init() {
    CONFIG.debug.enabled = false;
    if (CONFIG.debug.enabled && CONFIG.debug.fastMode) {
      BALANCE.wave.durationSec       = 15;
      BALANCE.levelUp.expBase        = 10;
      BALANCE.player.hp              = 500;
      BALANCE.drops.powerupChance    = 0.8;
      BALANCE.drops.magnetChance     = 0.5;
      Object.keys(BALANCE.enemies).forEach(k => { BALANCE.enemies[k].hp = 1; });
    }
    Input.init();
    Renderer.init('gameCanvas');
    Audio.init();
    this._showMainMenu();
    requestAnimationFrame(t => this._loop(t));
  },

  // ---- State transitions ----

  _showMainMenu() {
    this.state = State.MAIN_MENU;
    const callbacks = {
      onPlay: () => this._showElementSelect(callbacks.adminMode ?? false),
      onInfo: () => InfoMenuUI.show(() => this._showMainMenu()),
    };
    MainMenuUI.show(callbacks);
  },

  _showElementSelect(adminMode = false) {
    this.state = State.ELEMENT_SELECT;
    ElementSelectorUI.show(elementId => this._startRun(elementId, adminMode));
  },

  _startRun(elementId, adminMode = false) {
    this.player    = new Player(elementId);
    this.world     = createWorld();

    if (adminMode) {
      BALANCE.wave.durationSec = 15;
      Modifier.addMul(this.player._expMulMod,  99);
      Modifier.addMul(this.player._goldMulMod, 99);
    } else {
      BALANCE.wave.durationSec = 60;
    }
    this.world.onKill = (enemy) => handleKill(enemy, this.world, this.player, Juice);
    SpawnerSystem.reset();
    Juice.reset();
    SpawnerSystem.buildWave(1, this.world, this.player);
    this._fireTimer = 0;
    this._waveStats = null;
    this._snapshotWaveStart();
    this._lastTime  = performance.now();
    this.state      = State.PLAYING;
    Audio.play('waveStart');
  },

  _snapshotWaveStart() {
    this._waveStartKills = this.world?.kills ?? 0;
    this._waveStartGold  = this.player?.gold  ?? 0;
    this._waveStartLevel = this.player?.level ?? 1;
    this._waveStartTime  = this.world?.elapsed ?? 0;
  },

  _startWaveTransition() {
    this._waveStats = {
      wave:         this.world.wave,
      kills:        this.world.kills - this._waveStartKills,
      goldEarned:   Math.max(0, this.player.gold - this._waveStartGold),
      levelReached: this.player.level,
      timeSec:      this.world.isBossWave
        ? Math.round(this.world.elapsed - (this._waveStartTime ?? 0))
        : Math.round(CONFIG.wave.durationSec - Math.max(0, this.world.waveTimeLeft)),
    };
    this._transitionTimer = 3.0;
    this.state = State.WAVE_TRANSITION;
  },

  _openHub() {
    // Faiz bonusu — eldeki altının waveGoldInterest yüzdesi kadar bonus
    if (this.player.waveGoldInterest > 0 && this.player.gold > 0) {
      const interest = Math.floor(this.player.gold * this.player.waveGoldInterest);
      if (interest > 0) {
        this.player.gold += interest;
        this.world._pendingSounds.push('buy');
      }
    }
    this.state = State.HUB;
    WaveHubUI.show({
      player:    this.player,
      world:     this.world,
      waveStats: this._waveStats,
      onBuy:     () => Audio.play('buy'),
      onContinue:() => this._nextWave(),
    });
  },

  _nextWave() {
    WaveHubUI.hide();
    const nextWave = this.world.wave + 1;
    this.world.enemies      = [];
    this.world.bullets      = [];
    this.world.enemyBullets = [];
    this.world.onKill = (enemy) => handleKill(enemy, this.world, this.player, Juice);
    SpawnerSystem.buildWave(nextWave, this.world, this.player);
    this._waveStats = null;
    this._snapshotWaveStart();
    this._lastTime = performance.now();
    this.state     = State.PLAYING;
    Audio.play('waveStart');
  },

  _pause() {
    if (this.state !== State.PLAYING) return;
    this.state = State.PAUSED;
    PauseUI.show({
      player:   this.player,
      world:    this.world,
      onResume:  () => { PauseUI.hide(); this._resume(); },
      onQuit:    () => { PauseUI.hide(); this._showMainMenu(); },
    });
  },

  _resume() {
    this._lastTime = performance.now(); // prevent huge dt jump
    this.state = State.PLAYING;
  },

  _gameOver() {
    this.state = State.GAME_OVER;
    Juice.shake(CONFIG.fx.shakeBoss);
    GameOverUI.show({
      player:  this.player,
      world:   this.world,
      onRetry: () => this._showElementSelect(),
      onMenu:  () => this._showMainMenu(),
    });
  },

  // ---- Main loop ----

  _loop(ts) {
    requestAnimationFrame(t => this._loop(t));
    const dt = Math.min((ts - this._lastTime) / 1000, 0.1);
    this._lastTime = ts;

    Juice.update();

    // Camera must update first so mouseWorld is computed from the correct position
    if (this.player) {
      Renderer.updateCamera(this.player, Juice.getShakeOffset());
      Input.mouseWorld = {
        x: Input.mouseScreen.x + Renderer.cameraX,
        y: Input.mouseScreen.y + Renderer.cameraY,
      };
    }

    if (this.state === State.PLAYING) {
      this._update(dt);
      Renderer.draw(this.player, this.world, Input, this);
    } else if (this.state === State.WAVE_TRANSITION) {
      this._transitionTimer -= dt;
      if (this._transitionTimer <= 0) this._openHub();
      Renderer.draw(this.player, this.world, Input, this);
    } else if (this.state === State.PAUSED || this.state === State.HUB) {
      // Render frozen frame behind overlays
      Renderer.draw(this.player, this.world, Input, this);
    }
    // MAIN_MENU / ELEMENT_SELECT / GAME_OVER: overlays handle themselves, no canvas
    Input.clearPressed();
  },

  _update(dt) {
    const { player, world } = this;

    // Elapsed / score
    world.elapsed   += dt;
    world.difficulty = calculateDifficulty(world.wave, player._marketDiffBonus);
    player.score    += CONFIG.score.survivalPerSec * dt * world.difficulty;

    // Ability input (Q / E / R / Shift) — consumed once per press
    if (Input.consumePress('q'))     AbilitySystem.cast('q',     player, world, Juice);
    if (Input.consumePress('e'))     AbilitySystem.cast('e',     player, world, Juice);
    if (Input.consumePress('r'))     AbilitySystem.cast('r',     player, world, Juice);
    if (Input.consumePress('shift')) AbilitySystem.cast('shift', player, world, Juice);

    // Debug overlay toggle
    if (Input.consumePress('debug')) this._debugMode = !this._debugMode;
    if (Input.consumePress('aimMode')) player.aimMode = (player.aimMode + 1) % 3;

    // Pause
    if (Input.consumePress('pause')) { this._pause(); return; }

    // Level-up kart seçimi
    if (world._pendingLevelUp) {
      world._pendingLevelUp = false;
      this.state = State.PAUSED;
      LevelUpUI.show(player, (card) => {
        const fn = SkillEffects[card.stat];
        if (fn) fn(player, card.step);
        this._resume();
      });
      return;
    }

    // Systems — movement first so player.angle is set from current mouseWorld
    // Mouse dünya pozisyonunu world'e yaz — ability handler'ları okur
    world._mouseWorld = { x: Input.mouseWorld.x, y: Input.mouseWorld.y };
    AbilitySystem.update(player, world, Juice);
    MovementSystem.update(player, world, Input, dt);

    // Auto-fire every frame toward player.angle, no input required
    this._fireTimer--;
    if (this._fireTimer <= 0) {
      this._fireTimer = player.fireCooldown;
      this._spawnBullets(player, world);
    }
    SpawnerSystem.update(dt, player, world);

    // Env object updates
    world.envObjects.forEach(obj => { obj.update(); });
    world.envObjects = world.envObjects.filter(obj => !obj.isDead);

    // Collision
    world._lightningChains = []; // clear each frame before collision fills it
    const _hpBefore = player.hp;
    CollisionSystem.update(
      player, world, Juice,
      (enemy, w, p, j) => handleKill(enemy, w, p, j),
      () => this._gameOver()
    );
    if (player.hp < _hpBefore) Audio.play('hurt');
    world._pendingSounds.forEach(s => Audio.play(s));
    world._pendingSounds = [];
    // Transfer lightning chain positions to renderer VFX
    world._lightningChains.forEach(c => LightningVFX.add(c.x1, c.y1, c.x2, c.y2));
    // Transfer ice Q burst to renderer VFX
    if (world._iceVFX) {
      IceVFX.trigger(world._iceVFX.x, world._iceVFX.y, world._iceVFX.innerR, world._iceVFX.outerR);
      world._iceVFX = null;
    }

    // Cleanup dead entities
    world.bullets      = world.bullets.filter(b => !b.shouldDestroy);
    world.enemyBullets = world.enemyBullets.filter(b => !b.shouldDestroy);
    world.powerUpDrops = world.powerUpDrops.filter(p => !p.isDead);

    // Clear bonus: spawn bonus orbs every 60 frames
    if (world.clearBonus && !world.isBossWave) {
      world._bonusOrbTimer++;
      if (world._bonusOrbTimer >= 60) {
        world._bonusOrbTimer = 0;
        for (let i = 0; i < BALANCE.wave.clearBonusOrbCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 50 + Math.random() * 200;
          world.orbs.push(new Orb(
            player.x + Math.cos(a) * r,
            player.y + Math.sin(a) * r,
            'exp', Math.round(BALANCE.wave.clearBonusMultiplier * world.difficulty)
          ));
          world.orbs.push(new Orb(
            player.x + Math.cos(a + 0.3) * r,
            player.y + Math.sin(a + 0.3) * r,
            'gold', Math.round(BALANCE.wave.clearBonusMultiplier * world.difficulty)
          ));
        }
      }
    }

    // Wave end check
    if (world.waveTimeLeft <= 0 && !world.isBossWave) {
      this._endWave();
      return;
    }
    // Boss wave: ends when boss is dead
    if (world.isBossWave && world.enemies.length === 0) {
      this._startWaveTransition();
    }
  },

  _endWave() {
    const { world, player } = this;
    if (world.clearBonus) {
      // Dalga temizlendi — haritadaki orb'ları otomatik topla
      let totalExp = 0, totalGold = 0;
      world.orbs.forEach(o => {
        if (o.kind === 'exp') { totalExp += o.amount; player.gainExp(o.amount); }
        else                  { totalGold += o.amount; player.gold += o.amount; }
      });
      world.orbs = [];
      const parts = [];
      if (totalExp  > 0) parts.push(`+${totalExp} EXP`);
      if (totalGold > 0) parts.push(`+${totalGold} G`);
      if (parts.length > 0) {
        Juice.addPickupText(player.x, player.y - 50, `DALGA SONU: ${parts.join('  ')}`, '#00f0ff');
        Juice.hudFlash.exp  = 60;
        Juice.hudFlash.gold = 60;
      }
    } else {
      // Süre doldu — kalan düşmanları sil, orb'ları da temizle (drop yok)
      world.enemies.forEach(e => Juice.addExplosion(e.x, e.y, e.color, 5));
      world.enemies      = [];
      world.enemyBullets = [];
      world.orbs         = [];
    }

    world.clearBonus     = false;
    world._bonusOrbTimer = 0;
    this._startWaveTransition();
  },

  _spawnBullets(player, world) {
    // Hedef açısını belirle
    let targetAngle = player.angle;

    if (player.aimMode === 1 && world.enemies.length > 0) {
      // En yakın düşman
      let nearest = null, nearestD = Infinity;
      world.enemies.forEach(e => {
        if (e.isDead) return;
        const d = (e.x-player.x)**2 + (e.y-player.y)**2;
        if (d < nearestD) { nearestD = d; nearest = e; }
      });
      if (nearest) {
        targetAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
        player.angle = targetAngle;
      }
    } else if (player.aimMode === 2 && world.enemies.length > 0) {
      // En yüksek HP'li düşman
      let strongest = null, maxHp = -Infinity;
      world.enemies.forEach(e => {
        if (e.isDead) return;
        if (e.hp > maxHp) { maxHp = e.hp; strongest = e; }
      });
      if (strongest) {
        targetAngle = Math.atan2(strongest.y - player.y, strongest.x - player.x);
        player.angle = targetAngle;
      }
    }

    const count = Math.min(8, Math.max(1, player.bulletCount));
    const angles = [];
    for (let i = 0; i < count; i++) {
      angles.push(targetAngle + (i / count) * Math.PI * 2);
    }
    angles.forEach(a => {
      const ox = player.x + Math.cos(a) * player.r;
      const oy = player.y + Math.sin(a) * player.r;
      world.bullets.push(new Bullet(ox, oy, a, player));
      if (player.multicastChance > 0 && Math.random() < player.multicastChance) {
        const spread = (Math.random() - 0.5) * 0.15;
        world.bullets.push(new Bullet(ox, oy, a + spread, player));
      }
    });
    Audio.play('shoot');
  },
};
