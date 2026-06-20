// ============================================================
// SYSTEMS — stateless logic that operates on entities.
// Each system exports an object with an update() and helpers.
// No entity class imports another entity class.
// ============================================================

import { CONFIG }      from './config.js';
import { BALANCE }     from './balance.js';
import { Renderer }    from './renderer.js';
import { Effects, Behaviors, SkillEffects, AbilityHandlers } from './components.js';
import { Enemy, Bullet, EnemyBullet, Orb, PowerUpDrop, EnvObject } from './entities.js';
import { rand, randInt, clamp, dist, angle, spawnAroundPoint, weightedRandom, Modifier } from './utils.js';

// Difficulty hesabı tek yer — game.js ve SpawnerSystem buradan okur
export function calculateDifficulty(wave, marketBonus = 0) {
  return BALANCE.difficulty.base
    * Math.pow(BALANCE.difficulty.growth, wave - 1)
    + marketBonus;
}

// ============================================================
// WORLD — shared mutable state passed between systems
// ============================================================
export function createWorld() {
  return {
    enemies:      [],
    bullets:      [],     // player bullets
    enemyBullets: [],
    orbs:         [],
    powerUpDrops: [],
    envObjects:   [],
    particles:    [],     // visual only, owned by JuiceManager
    wave:         0,
    waveTimeLeft: 0,
    isBossWave:   false,
    bossIndex:    0,
    difficulty:   BALANCE.difficulty.base,
    kills:        0,
    elapsed:      0,
    _lightningChains: [],   // filled during collision, read by renderer

    waveEnemyTotal:   200,
    waveEnemySpawned: 0,
    waveEnemyKilled:  0,
    clearBonus:       false,
    _bonusOrbTimer:   0,
    _pendingSounds:   [],
    _debugLog:        [],
    onKill:           null,   // game.js tarafından set edilir
    _activeZones:     [],     // element Q zone'ları

    spawnEnemy(shapeId, tierId, wave, x, y) {
      this.enemies.push(new Enemy(shapeId, tierId, wave, x, y, this));
    },
    spawnEnemyBullets(shots, sourceEnemy) {
      shots.forEach(s => {
        this.enemyBullets.push(new EnemyBullet(s.x, s.y, s.angle, BALANCE.enemyBullet.baseDamage * (sourceEnemy.tierId ?? 1)));
      });
    },
  };
}

// ============================================================
// SPAWNER SYSTEM
// ============================================================
export const SpawnerSystem = {
  _queue:              [],
  _timer:              0,
  _nextAt:             0,
  _envTimer:           0,
  _currentWeights:     {},
  _currentTierWeights: [],

  reset() {
    this._queue              = [];
    this._timer              = 0;
    this._nextAt             = 0;
    this._envTimer           = 0;
    this._currentWeights     = {};
    this._currentTierWeights = [];
  },

  buildWave(wave, world, player) {
    world.wave            = wave;
    world.isBossWave      = wave % BALANCE.wave.bossEvery === 0;
    world.waveTimeLeft    = world.isBossWave ? Infinity : BALANCE.wave.durationSec;
    world.difficulty      = calculateDifficulty(wave);
    world.waveEnemySpawned = 0;
    world.waveEnemyKilled  = 0;
    world.waveEnemyTotal   = BALANCE.wave.maxEnemies;
    world.clearBonus       = false;
    world._bonusOrbTimer   = 0;
    this._queue   = [];
    this._nextAt  = this._timer;

    if (world.isBossWave) {
      this._spawnBoss(world);
      return;
    }

    this._currentWeights     = this._rollWeights();
    this._currentTierWeights = this._rollTierWeights(player?.luck ?? 0);
    const waveFixedTypes = {
      1: 'triangle',
      2: 'square',
      3: 'pentagon',
      4: 'hexagon',
    };
    if (waveFixedTypes[wave]) {
      this._currentWeights = { [waveFixedTypes[wave]]: 100 };
    }
    world.waveWeights         = this._currentWeights;
    world.waveTierWeights     = this._currentTierWeights;
    world._waveWeightShowTimer = 180;

    this._buildQueue(wave);
  },

  _buildQueue(wave) {
    const count = BALANCE.wave.maxEnemies;
    const gap   = Math.floor(BALANCE.wave.durationSec * 1000 / count);

    for (let i = 0; i < count; i++) {
      const shapeId       = this._rollShape();
      const tierId        = this._rollTier();
      const extraBehavior = this._rollExtraBehavior(wave);
      this._queue.push({
        shapeId, tierId, extraBehavior,
        at: this._nextAt + (i + 1) * gap,
      });
    }
    this._nextAt = this._queue.length
      ? this._queue[this._queue.length - 1].at
      : this._timer;
  },

  _rollWeights() {
    const weights = {};
    Object.entries(BALANCE.enemies).forEach(([id, cfg]) => {
      const min = cfg.minWeight ?? cfg.spawnWeight ?? 10;
      const max = cfg.maxWeight ?? cfg.spawnWeight ?? 10;
      weights[id] = min + Math.random() * (max - min);
    });
    return weights;
  },

  _rollShape() {
    const entries = Object.entries(this._currentWeights);
    if (!entries.length) return 'triangle';
    const total = entries.reduce((s, [, w]) => s + w, 0);
    if (!total) return 'triangle';
    let r = Math.random() * total;
    for (const [id, w] of entries) {
      r -= w;
      if (r <= 0) return id;
    }
    return 'triangle';
  },

  _rollTierWeights(luck = 0) {
    const luckCap = BALANCE.luck?.cap ?? 5.0;
    const t = Math.min(luck / luckCap, 1.0);
    return BALANCE.tiers.map(tier => {
      const min = tier.minWeight ?? 10;
      const max = tier.maxWeight ?? 10;
      return min + (max - min) * t;
    });
  },

  _rollTier() {
    const weights = this._currentTierWeights;
    if (!weights.length) return 0;
    const total   = weights.reduce((s, w) => s + w, 0);
    if (!total) return 0;
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return 0;
  },

  _rollExtraBehavior(wave) {
    const pool = Object.entries(CONFIG.behaviors)
      .filter(([, cfg]) => wave >= cfg.unlockWave && Math.random() < cfg.chance);
    if (!pool.length) return null;
    const [id, cfg] = pool[Math.floor(Math.random() * pool.length)];
    return { id, ...cfg };
  },

  _spawnBoss(world) {
    const bc    = CONFIG.boss;
    const bb    = BALANCE.boss;
    const bi    = world.bossIndex;
    const pos   = this._edgePos();
    const boss  = new Enemy('triangle', 0, world.wave, pos.x, pos.y, world);
    boss.r            = bc.r;
    boss.sides        = bc.sides;
    boss.color        = bc.color;
    boss.hp           = bb.baseHp + bi * bb.hpPerBoss;
    boss.maxHp        = boss.hp;
    boss.speed        = bb.speed * CONFIG.player.baseSpeed;
    boss.points       = bb.points * (bi + 1);
    boss.exp          = bb.exp    * (bi + 1);
    boss.gold         = bb.gold   * (bi + 1);
    boss.behaviorId   = bc.behavior.id;
    boss.behaviorParams = { ...bc.behavior };
    boss.onContactEffects = [{ effect: 'damagePlayer', amount: bb.contactDmg }];
    boss.onDeath      = bc.onDeath;
    boss.isBoss       = true;
    world.enemies.push(boss);
    world.bossIndex++;
  },

  _edgePos() {
    const margin = 80;
    const camX   = Renderer.cameraX;
    const camY   = Renderer.cameraY;
    const camW   = window.innerWidth;
    const camH   = window.innerHeight;
    const WW     = CONFIG.world.width;
    const WH     = CONFIG.world.height;
    const edge   = Math.floor(Math.random() * 4);
    let x, y;
    if      (edge === 0) { x = camX + Math.random() * camW; y = camY - margin; }
    else if (edge === 1) { x = camX + camW + margin;        y = camY + Math.random() * camH; }
    else if (edge === 2) { x = camX + Math.random() * camW; y = camY + camH + margin; }
    else                 { x = camX - margin;               y = camY + Math.random() * camH; }
    return {
      x: Math.max(0, Math.min(WW, x)),
      y: Math.max(0, Math.min(WH, y)),
    };
  },

  update(dt, player, world) {
    // Env object spawning
    this._envTimer -= dt;
    if (this._envTimer <= 0) {
      this._envTimer = CONFIG.wave.envSpawnIntervalSec;
      this._spawnEnvObject(player, world);
    }

    if (world.isBossWave) return; // boss wave ends on boss death

    if (world._waveWeightShowTimer > 0) world._waveWeightShowTimer--;

    // Wave timer
    world.waveTimeLeft -= dt;
    if (world.waveTimeLeft <= 0) return; // signal to game loop

    // Enemy spawn queue — cap at waveEnemyTotal
    this._timer += dt * 1000;
    while (this._queue.length && this._timer >= this._queue[0].at) {
      if (world.waveEnemySpawned >= world.waveEnemyTotal) break;
      const s   = this._queue.shift();
      const pos = this._edgePos();
      const e   = new Enemy(s.shapeId, s.tierId, world.wave, pos.x, pos.y, world);
      if (s.extraBehavior) {
        e.extraBehaviorId     = s.extraBehavior.id;
        e.extraBehaviorParams = s.extraBehavior;
      }
      world.enemies.push(e);
      world.waveEnemySpawned++;
    }
  },

  _spawnEnvObject(player, world) {
    // Weighted random from envObjects
    const weights = {};
    Object.entries(CONFIG.envObjects).forEach(([k, v]) => { weights[k] = v.spawnWeight; });
    const typeId = weightedRandom(weights);
    const px = rand(100, CONFIG.world.width  - 100);
    const py = rand(100, CONFIG.world.height - 100);
    world.envObjects.push(new EnvObject(px, py, typeId));
  },
};

// ============================================================
// MOVEMENT SYSTEM — update entities positions
// ============================================================
export const MovementSystem = {
  update(player, world, input, dt) {
    this._movePlayer(player, input);
    this._moveEnemies(player, world, dt);
    this._moveBullets(world);
    this._moveOrbs(player, world);
  },

  _movePlayer(player, input) {
    let mx = 0, my = 0;
    if (input.held('up'))    my -= 1;
    if (input.held('down'))  my += 1;
    if (input.held('left'))  mx -= 1;
    if (input.held('right')) mx += 1;
    const len = Math.hypot(mx, my) || 1;
    const spd = player.effectiveSpeed;
    player.x = clamp(player.x + (mx / len) * spd, player.r, CONFIG.world.width  - player.r);
    player.y = clamp(player.y + (my / len) * spd, player.r, CONFIG.world.height - player.r);
    // Sadece mouse modunda açı mouse'a göre güncellenir
    // Auto-aim modlarında açı _spawnBullets içinde güncellenir
    if (player.aimMode === 0) {
      player.angle = Math.atan2(input.mouseWorld.y - player.y, input.mouseWorld.x - player.x);
    }
  },

  _moveEnemies(player, world, dt) {
    const ctx = { world, spawnEnemyBullets: world.spawnEnemyBullets.bind(world) };
    world.enemies.forEach(e => {
      if (e.freezeTimer > 0) { e.freezeTimer--; e.t++; return; }
      if (e.slowTimer   > 0) { e.slowTimer--; e.slowFactor = e.behaviorParams?.slowFactor ?? 0.5; }
      else { e.slowFactor = 1; }
      // Knockback physics
      if (Math.abs(e.vx) > 0.1 || Math.abs(e.vy) > 0.1) {
        e.x += e.vx; e.y += e.vy; e.vx *= 0.82; e.vy *= 0.82;
      }
      // Primary behavior
      Behaviors.update(e.behaviorId, e, player, dt, ctx);
      // Extra behavior overlay (zigzag, shooter, etc.)
      if (e.extraBehaviorId) Behaviors.update(e.extraBehaviorId, e, player, dt, ctx);
      // Clamp to world
      e.x = clamp(e.x, e.r, CONFIG.world.width  - e.r);
      e.y = clamp(e.y, e.r, CONFIG.world.height - e.r);
      e.t++;
    });
  },

  _moveBullets(world) {
    world.bullets.forEach(b => b.update());
    world.enemyBullets.forEach(b => b.update());
  },

  _moveOrbs(player, world) {
    world.orbs.forEach(o => o.update(player));
    world.powerUpDrops.forEach(p => p.update());
  },
};

// ============================================================
// COLLISION SYSTEM
// ============================================================
export const CollisionSystem = {
  update(player, world, juice, onKill, onPlayerDead) {
    this._playerBulletsVsEnemies(player, world, juice, onKill);
    this._enemyBulletsVsPlayer(player, world, juice, onPlayerDead);
    this._enemiesVsPlayer(player, world, juice, onPlayerDead);
    this._orbPickup(player, world, juice, onKill);
    this._powerupPickup(player, world, juice);
    this._bulletsVsEnvObjects(player, world, juice);
    this._envZoneTick(player, world, juice);
    this._activeZonesTick(player, world, juice, onKill);
  },

  _playerBulletsVsEnemies(player, world, juice, onKill) {
    for (const b of world.bullets) {
      if (b.shouldDestroy) continue;
      for (let i = world.enemies.length - 1; i >= 0; i--) {
        const e = world.enemies[i];
        if (e.isDead) continue;
        const rr = e.r + b.r;
        if ((b.x-e.x)**2 + (b.y-e.y)**2 > rr*rr) continue;

        // Apply bullet damage
        let dmg = b.damage;
        e.hp -= dmg;

        // Lifesteal
        if (player.lifeSteal > 0) {
          player.hp = Math.min(player.maxHp, player.hp + dmg * player.lifeSteal);
        }

        juice.addDmgNumber(e.x, e.y - e.r, Math.round(dmg), b.isCrit, b.color);
        juice.addExplosion(b.x, b.y, b.color, 4);

        const ctx = { enemy: e, bullet: b, world, juice, player };
        Effects.applyList(b.onHitEffects, ctx);

        if (e.hp <= 0) {
          juice.addExplosion(e.x, e.y, e.color, 16);
          juice.shake(CONFIG.fx.shakeKillEnemy);
          Effects.applyList(e.onDeath, { enemy: e, world, juice });
          onKill(e, world, player, juice);
          world.enemies.splice(i, 1);
        }

        // Pierce: keep going if pierceLeft > 0
        b.pierceLeft--;
        if (b.pierceLeft < 0) b.shouldDestroy = true;
        break;
      }
    }
  },

  _enemyBulletsVsPlayer(player, world, juice, onPlayerDead) {
    for (let i = world.enemyBullets.length - 1; i >= 0; i--) {
      const b = world.enemyBullets[i];
      const rr = player.hitRadius + b.r;
      if ((b.x-player.x)**2 + (b.y-player.y)**2 > rr*rr) continue;
      if (player.invulnTimer > 0) { world.enemyBullets.splice(i, 1); continue; }
      const reduced = Math.max(b.damage * 0.1, b.damage - player.armor);
      player.hp -= reduced;
      player.invulnTimer = CONFIG.player.invulnFrames;
      juice.shake(CONFIG.fx.shakeHitPlayer);
      juice.addExplosion(player.x, player.y, '#ff3355', 14);
      world.enemyBullets.splice(i, 1);
      if (player.hp <= 0) { onPlayerDead(); return; }
    }
  },

  _enemiesVsPlayer(player, world, juice, onPlayerDead) {
    for (let i = world.enemies.length - 1; i >= 0; i--) {
      const e = world.enemies[i];
      if (e.isDead || e._fuseActive) continue;
      const rr = player.hitRadius + e.r;
      if ((e.x-player.x)**2 + (e.y-player.y)**2 > rr*rr) continue;
      const ctx = { player, enemy: e, world, juice };
      Effects.applyList(e.onContactEffects, ctx);
      juice.addExplosion(player.x, player.y, '#ff3355', 18);
      juice.shake(CONFIG.fx.shakeHitPlayer);

      // Üçgen çarpınca kendisi de yok olur
      if (e.shapeId === 'triangle') {
        juice.addExplosion(e.x, e.y, e.color, 10);
        world.onKill?.(e);
        world.enemies.splice(i, 1);
      }

      if (player.hp <= 0) { onPlayerDead(); return; }
    }
  },

  _orbPickup(player, world, juice, onKill) {
    for (let i = world.orbs.length - 1; i >= 0; i--) {
      const o = world.orbs[i];
      const rr = player.r + o.r;
      if ((o.x-player.x)**2 + (o.y-player.y)**2 > rr*rr) continue;
      if (o.kind === 'exp') {
        const leveled = player.gainExp(o.amount);
        if (leveled) {
          juice.addExplosion(player.x, player.y, '#00ff88', 25);
          world._pendingLevelUp = true;
        }
        if (!o.magnetized) {
          juice.addPickupText(o.x, o.y, `+${o.amount} EXP`, '#b366ff');
          juice.hudFlash.exp = 20;
        }
      } else {
        player.gold += o.amount;
        if (!o.magnetized) {
          juice.addPickupText(o.x, o.y, `+${o.amount} G`, '#ffcc33');
          juice.hudFlash.gold = 20;
        }
      }
      world.orbs.splice(i, 1);
    }
  },

  _powerupPickup(player, world, juice) {
    for (let i = world.powerUpDrops.length - 1; i >= 0; i--) {
      const p = world.powerUpDrops[i];
      if (p.isDead) { world.powerUpDrops.splice(i, 1); continue; }
      const rr = player.r + p.r;
      if ((p.x-player.x)**2 + (p.y-player.y)**2 > rr*rr) continue;
      const def = p.def;
      // Apply powerup effect
      if (def.effect.healFlat)    player.hp = Math.min(player.maxHp, player.hp + def.effect.healFlat);
      if (def.effect.tripleShot)  player.powerups['triple'] = Math.min((player.powerups['triple'] ?? 0) + def.duration, CONFIG.powerup?.maxDuration ?? 600);
      if (def.effect.cooldownMul) player.powerups['rapid']  = Math.min((player.powerups['rapid']  ?? 0) + def.duration, CONFIG.powerup?.maxDuration ?? 600);
      if (def.effect.magnetPull) {
        let totalExp = 0, totalGold = 0;
        world.orbs.forEach(o => {
          o.magnetized = true;
          if (o.kind === 'exp') totalExp  += o.amount;
          else                  totalGold += o.amount;
        });
        const parts = [];
        if (totalExp  > 0) parts.push(`+${totalExp} EXP`);
        if (totalGold > 0) parts.push(`+${totalGold} G`);
        if (parts.length > 0) {
          juice.addPickupText(player.x, player.y - 40, parts.join('  '), '#ff00d4');
          juice.hudFlash.exp  = 30;
          juice.hudFlash.gold = 30;
        }
      }
      juice.addExplosion(p.x, p.y, def.color, 12);
      world.powerUpDrops.splice(i, 1);
    }
  },

  _bulletsVsEnvObjects(player, world, juice) {
    for (const b of world.bullets) {
      if (b.shouldDestroy) continue;
      for (const obj of world.envObjects) {
        if (obj.shouldDestroy || obj.zoneActive) continue;
        if (obj.def.trigger !== 'bullet') continue;
        const rr = obj.r + b.r;
        if ((b.x-obj.x)**2 + (b.y-obj.y)**2 > rr*rr) continue;
        // Trigger env object effects
        const ctx = { pos: obj, envObj: obj, world, juice, player };
        Effects.applyList(obj.def.onTrigger, ctx);
        if (!obj.zoneActive) obj.shouldDestroy = true;
        b.shouldDestroy = true;
        break;
      }
    }
  },

  _envZoneTick(player, world, juice) {
    for (const obj of world.envObjects) {
      if (!obj.zoneActive) continue;
      obj.zoneTimer--;
      if (obj.zoneTimer <= 0) { obj.shouldDestroy = true; obj.zoneActive = false; continue; }
      if (obj.zoneTick) {
        const { effect, ...params } = obj.zoneTick;
        Effects.apply(effect, { ...params, dt: 1/60 }, { pos: obj, world, juice, player });
      }
    }
  },

  _activeZonesTick(player, world, juice, onKill) {
    if (!world._activeZones?.length) return;
    const toRemove = [];

    world._activeZones.forEach((zone, zi) => {
      zone.timer--;
      if (zone.timer <= 0) { toRemove.push(zi); return; }

      // Zone oyuncuya yapışık — her frame güncelle
      if (zone.owner) {
        zone.x = zone.owner.x;
        zone.y = zone.owner.y;
      }

      // Rüzgar zone'u — her frame içe çek
      if (zone.pullForce !== undefined) {
        world.enemies.forEach(e => {
          if (e.hp <= 0) return;
          const dx = e.x - zone.x;
          const dy = e.y - zone.y;
          const d2 = dx*dx + dy*dy;
          if (d2 > zone.radius * zone.radius) return;
          const d  = Math.sqrt(d2) || 1;
          const nx = dx / d;
          const ny = dy / d;
          e.vx = (e.vx ?? 0) - nx * zone.pullForce;
          e.vy = (e.vy ?? 0) - ny * zone.pullForce;
        });
      }

      // Şimşek zone'u — her frame stun uygula
      if (zone.stunDur !== undefined) {
        world.enemies.forEach(e => {
          if (e.hp <= 0) return;
          const dx = e.x - zone.x;
          const dy = e.y - zone.y;
          if (dx*dx + dy*dy > zone.radius * zone.radius) return;
          Effects.apply('freeze', { duration: zone.stunDur }, { enemy: e });
        });
      }

      // Buz zone'u — her frame yavaşlatma uygula (hasar değil)
      if (zone.slowFactor !== undefined) {
        world.enemies.forEach(e => {
          if (e.hp <= 0) return;
          const dx = e.x - zone.x;
          const dy = e.y - zone.y;
          if (dx*dx + dy*dy > zone.radius * zone.radius) return;
          Effects.apply('slow', { factor: zone.slowFactor, duration: 10 }, { enemy: e });
        });
      }

      if (zone.timer % 60 !== 0) return;

      const toKill = [];
      world.enemies.forEach(e => {
        if (e.hp <= 0) return;
        const dx = e.x - zone.x;
        const dy = e.y - zone.y;
        if (dx*dx + dy*dy > zone.radius * zone.radius) return;

        const dmg = zone.dps * (zone.owner?.abilityDmgMul ?? 1);
        e.hp -= dmg;
        juice.addDmgNumber(e.x, e.y, Math.round(dmg), false, zone.color);
        juice.addExplosion(e.x, e.y, zone.color, 2);

        // Buz zone'u yavaşlatma
        if (zone.slowFactor !== undefined) {
          Effects.apply('slow', { factor: zone.slowFactor, duration: 90 }, { enemy: e });
        }

        if (e.hp <= 0) toKill.push(e);
      });

      toKill.forEach(e => {
        juice.addExplosion(e.x, e.y, e.color, 16);
        world.onKill?.(e);
        world.enemies.splice(world.enemies.indexOf(e), 1);
      });

      juice.addExplosion(zone.x, zone.y, zone.color, 3);
    });

    for (let i = toRemove.length - 1; i >= 0; i--) {
      world._activeZones.splice(toRemove[i], 1);
    }
  },
};

// ============================================================
// ABILITY SYSTEM
// ============================================================
export const AbilitySystem = {
  // Try to cast slot (q/e/shift). Returns true if cast.
  cast(slotId, player, world, juice) {
    const ability = player.abilitySlots[slotId];
    if (!ability) return false;
    if (player.abilityCooldowns[slotId] > 0) return false;

    player.abilityCooldowns[slotId] = Math.round(ability.cooldown * (1 - player.abilityCDR));
    if (ability.duration) player.abilityTimers[slotId] = ability.duration;

    // Dispatch to element Q handlers or generic ability handlers
    this._executeAbility(ability, slotId, player, world, juice);
    return true;
  },

  _executeAbility(ability, slotId, player, world, juice) {
    AbilityHandlers.execute(ability, player, world, juice);
  },

  // Called each frame to tick cooldowns + stone orbit
  update(player, world, juice) {
    // Tick cooldowns
    ['q', 'e', 'r', 'shift'].forEach(slot => {
      if (player.abilityCooldowns[slot] > 0) player.abilityCooldowns[slot]--;
      if (player.abilityTimers[slot]    > 0) player.abilityTimers[slot]--;
    });

    // Tick powerups
    Object.keys(player.powerups).forEach(k => {
      if (player.powerups[k] > 0) player.powerups[k]--;
    });

    // Taş orbit tick
    if (player.orbits?.length > 0) {
      const toRemove = [];
      player.orbits.forEach((orb, idx) => {
        if (!orb.alive) {
          orb.respawnTimer--;
          if (orb.respawnTimer <= 0) orb.alive = true;
          return;
        }

        // Süre kontrolü
        orb.timer--;
        if (orb.timer <= 0) { toRemove.push(idx); return; }

        // Döndür
        orb.angle += orb.orbitSpeed;
        const ox = player.x + Math.cos(orb.angle) * orb.orbitR;
        const oy = player.y + Math.sin(orb.angle) * orb.orbitR;

        // Düşman çarpışması
        for (let i = world.enemies.length - 1; i >= 0; i--) {
          const e = world.enemies[i];
          if (e.isDead) continue;
          const rr = e.r + orb.r;
          if ((ox-e.x)**2 + (oy-e.y)**2 > rr*rr) continue;

          e.hp -= orb.damage;
          juice.addDmgNumber(e.x, e.y, Math.round(orb.damage), false, orb.color);

          const kbA = Math.atan2(e.y - oy, e.x - ox);
          e.vx = (e.vx ?? 0) + Math.cos(kbA) * orb.knockback;
          e.vy = (e.vy ?? 0) + Math.sin(kbA) * orb.knockback;

          juice.addExplosion(ox, oy, orb.color, 5);

          if (e.hp <= 0) {
            juice.addExplosion(e.x, e.y, e.color, 16);
            world.onKill?.(e);
            world.enemies.splice(i, 1);
          }

          orb.alive        = false;
          orb.respawnTimer = 60;
          break;
        }

        // Env object çarpışması
        if (orb.alive) {
          world.envObjects.forEach(obj => {
            if (obj.shouldDestroy || obj.zoneActive) return;
            if (obj.def.trigger !== 'bullet') return;
            const rr = obj.r + orb.r;
            if ((ox-obj.x)**2 + (oy-obj.y)**2 > rr*rr) return;
            const ctx2 = { pos: obj, envObj: obj, world, juice, player };
            Effects.applyList(obj.def.onTrigger, ctx2);
            if (!obj.zoneActive) obj.shouldDestroy = true;
            orb.alive        = false;
            orb.respawnTimer = 60;
          });
        }
      });

      for (let i = toRemove.length - 1; i >= 0; i--) {
        player.orbits.splice(toRemove[i], 1);
      }
    }

    // Tick state timers
    if (player.dashActive        > 0) player.dashActive--;
    if (player.damageShieldTimer > 0) player.damageShieldTimer--;

    // Pasif can yenileme — 2 saniye sonra saniyede regenPerSec can yeniler
    if (player.hp < player.maxHp) {
      player._regenIdleFrames = (player._regenIdleFrames ?? 0) + 1;
      if (player._regenIdleFrames % 60 === 0
          && player._regenIdleFrames >= 120
          && player.regenPerSec > 0
          && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + player.regenPerSec);
      }
    }

  },
};

// ============================================================
// KILL HANDLER — called by CollisionSystem on enemy death
// ============================================================
export function handleKill(enemy, world, player, juice) {
  world.kills++;
  world.waveEnemyKilled++;
  player.score += enemy.points * world.difficulty;
  world._pendingSounds.push('kill');

  if (world._debugLog !== undefined) {
    world._debugLog.unshift({
      type:       'kill',
      shape:      enemy.shapeId,
      tier:       enemy.tierId + 1,
      hp:         enemy.maxHp,
      gold:       enemy.gold,
      exp:        enemy.exp,
      contactDmg: enemy.contactDamage,
    });
    if (world._debugLog.length > 8) world._debugLog.pop();
  }

  if (world.waveEnemyKilled >= world.waveEnemyTotal && world.waveTimeLeft > 0 && !world.clearBonus) {
    world.clearBonus = true;
  }

  // Drop EXP orb (always)
  world.orbs.push(new Orb(enemy.x, enemy.y, 'exp', Math.round(enemy.exp * world.difficulty * player.expMul)));

  // Drop gold orb (luck-scaled)
  if (Math.random() < BALANCE.drops.goldChance * player.luck) {
    world.orbs.push(new Orb(enemy.x, enemy.y, 'gold', Math.round(enemy.gold * world.difficulty * player.goldMul)));
  }

  // Drop power-up (luck-scaled, excludes magnet from pool)
  if (Math.random() < BALANCE.drops.powerupChance * player.luck) {
    const types = Object.keys(CONFIG.powerups).filter(k => k !== 'magnet' && CONFIG.powerups[k]);
    if (types.length > 0) {
      const typeId = types[Math.floor(Math.random() * types.length)];
      world.powerUpDrops.push(new PowerUpDrop(enemy.x, enemy.y, typeId));
    }
  }

  // Drop magnet (luck-scaled)
  if (Math.random() < BALANCE.drops.magnetChance * player.luck) {
    world.powerUpDrops.push(new PowerUpDrop(enemy.x, enemy.y, 'magnet'));
  }


  // Ice: frozen death explosion
  if (enemy._iceExplosionOnDeath) {
    Effects.apply('aoeExplosion', { radius: 80, damage: player.damage * 0.8, color: '#7fd8f8', shake: 6 },
      { pos: enemy, world, juice });
  }
}

// ============================================================
// UPGRADE / SHOP SYSTEM
// ============================================================
export const UpgradeSystem = {
  // Returns gold price for next level of a shop item
  getPrice(item, player) {
    if (item.consumable) return item.basePrice;
    const lvl = player.shopUpgrades[item.id] ?? 0;
    if (item.maxLevel && lvl >= item.maxLevel) return null;
    return Math.round(item.basePrice * Math.pow(CONFIG.shop.priceGrowth, lvl));
  },

  // Try to buy item. Returns true on success.
  buy(item, player) {
    const price = this.getPrice(item, player);
    if (price == null || player.gold < price) return false;
    player.gold -= price;
    if (!item.consumable) {
      player.shopUpgrades[item.id] = (player.shopUpgrades[item.id] ?? 0) + 1;
    }
    // Apply effect
    const fn = SkillEffects[item.apply];
    if (fn) fn(player, item.step);
    return true;
  },

  // Buy an ability for E or Shift slot
  buyAbility(abilityId, slot, player) {
    const ab = CONFIG.abilities[abilityId];
    if (!ab) return false;
    if (player.gold < ab.marketPrice) return false;
    player.gold -= ab.marketPrice;
    player.abilitySlots[slot] = { ...ab, id: abilityId };
    return true;
  },

};
