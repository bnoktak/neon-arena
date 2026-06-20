// ============================================================
// ENTITIES — game objects. Each knows its own state.
// They do NOT contain game logic — that lives in Systems.
// They do NOT know about each other directly.
// ============================================================

import { CONFIG } from './config.js';
import { BALANCE } from './balance.js';
import { rand, clamp, angle, Modifier } from './utils.js';

// ============================================================
// PLAYER
// ============================================================
export class Player {
  constructor(elementId) {
    const C  = CONFIG.player;
    const el = CONFIG.elements[elementId];

    this.element    = elementId;
    this.elementDef = el;

    this.x = CONFIG.world.width  / 2;
    this.y = CONFIG.world.height / 2;
    this.r = C.r;

    // Stats — all mutable, SkillEffects/shop modifies these directly
    const B = BALANCE.player;
    this._damageMod     = Modifier.create(B.damage);
    if (el.passive?.baseDamage) Modifier.addFlat(this._damageMod, el.passive.baseDamage);

    this._speedMod      = Modifier.create(B.speed * C.baseSpeed);
    if (el.passive?.speedFlat)  Modifier.addFlat(this._speedMod,  el.passive.speedFlat);

    this._maxHpMod      = Modifier.create(B.hp);
    if (el.passive?.maxHpFlat)  Modifier.addFlat(this._maxHpMod,  el.passive.maxHpFlat);

    this.hp             = Modifier.eval(this._maxHpMod);
    this._critChanceMod  = Modifier.create(B.critChance);
    if (el.passive?.critChanceFlat)  Modifier.addFlat(this._critChanceMod,  el.passive.critChanceFlat);

    this._critDmgMod     = Modifier.create(B.critDmgPct);
    if (el.passive?.critDmgPctFlat)  Modifier.addFlat(this._critDmgMod,     el.passive.critDmgPctFlat);

    this._luckMod        = Modifier.create(B.luck);
    if (el.passive?.luckFlat)        Modifier.addFlat(this._luckMod,        el.passive.luckFlat);

    this._goldMulMod     = Modifier.create(B.goldMul);
    this._expMulMod      = Modifier.create(B.expMul);
    this._pierceMod      = Modifier.create(B.pierce);
    this._lifeStealMod   = Modifier.create(B.lifeSteal);
    this._bulletCountMod = Modifier.create(B.bulletCount);
    this._cooldownMod    = Modifier.create(1.0);
    this._armorMod       = Modifier.create(BALANCE.player.armor);
    this._regenMod       = Modifier.create(BALANCE.player.regenPerSec);
    this._projSpeedMod   = Modifier.create(BALANCE.player.projectileSpeedMul);
    this._abilityCDRMod  = Modifier.create(BALANCE.player.abilityCDR);
    this._thornsMod            = Modifier.create(BALANCE.player.thornsPct);
    this._aoeMulMod            = Modifier.create(BALANCE.player.aoeMul);
    this._waveGoldInterestMod  = Modifier.create(BALANCE.player.waveGoldInterest);
    this._multicastMod         = Modifier.create(BALANCE.player.multicastChance);
    this._abilityDmgMod        = Modifier.create(BALANCE.player.abilityDmgMul);
    this._marketDiffBonus = 0;

    // Progression
    this.level   = 1;
    this.exp     = 0;
    this.expReq  = BALANCE.levelUp.expBase;
    this.sp      = 0;
    this.gold    = 0;
    this.score   = 0;

    // Ability slots: Q always = element, E/R/Shift = unlockable
    this.abilitySlots = { q: el.qAbility, e: null, r: null, shift: null };
    this.abilityCooldowns = { q: 0, e: 0, r: 0, shift: 0 };
    this.abilityTimers    = { q: 0, e: 0, r: 0, shift: 0 };

    // Power-up timers
    this.powerups = {};


    // Combat state
    this.aimMode         = 0;   // 0: mouse, 1: en yakın, 2: en güçlü
    this.invulnTimer     = 0;
    this.dashTimer       = 0;
    this.dashActive      = 0;
    this._regenIdleTimer = 0;

    // Stone orbit state (active during Q)
    this.orbits = [];

    // Shop upgrades tracking { itemId: level }
    this.shopUpgrades = {};

    // Angle for rendering
    this.angle = 0;
  }

  // Returns { damage, isCrit } — critChance > 100 converts overflow to bonus crit damage
  rollDamage(base) {
    const effectiveCrit = Math.min(100, this.critChance);
    const bonusCritDmg  = Math.max(0, this.critChance - 100);
    const isCrit        = Math.random() * 100 < effectiveCrit;
    const critBonus     = isCrit ? base * (this.critDamagePct + bonusCritDmg) / 100 : 0;
    return { damage: base + critBonus, isCrit };
  }

  // Returns true = alive (or hit blocked), false = dead
  tryHit(amount, attacker = null) {
    const reduced = Math.max(amount * 0.1, amount - this.armor);
    this.hp = Math.max(0, this.hp - reduced);
    if (this.thornsPct > 0 && attacker && attacker.hp > 0) {
      attacker.hp -= reduced * this.thornsPct;
    }
    return this.hp > 0;
  }

  gainExp(amount) {
    this.exp += amount;
    let leveled = false;
    while (this.exp >= this.expReq) {
      this.exp    -= this.expReq;
      this.level++;
      this.expReq  = this.level * BALANCE.levelUp.expGrowth;
      leveled = true;
    }
    return leveled;
  }

  get damage()        { return Modifier.eval(this._damageMod); }
  get speed()         { return Modifier.eval(this._speedMod);  }
  get maxHp()         { return Modifier.eval(this._maxHpMod);  }
  get critChance()    { return Modifier.eval(this._critChanceMod); }
  get critDamagePct() { return Modifier.eval(this._critDmgMod); }
  get luck()          { return Modifier.eval(this._luckMod); }
  get goldMul()       { return Modifier.eval(this._goldMulMod); }
  get expMul()        { return Modifier.eval(this._expMulMod); }
  get pierce()        { return Modifier.eval(this._pierceMod); }
  get lifeSteal()     { return Modifier.eval(this._lifeStealMod); }
  get bulletCount()   { return Math.min(8, Math.round(Modifier.eval(this._bulletCountMod))); }
  get cooldownMul()   { return Math.max(0.3, Modifier.eval(this._cooldownMod)); }
  get armor()               { return Modifier.eval(this._armorMod); }
  get regenPerSec()         { return Modifier.eval(this._regenMod); }
  get projectileSpeedMul()  { return Modifier.eval(this._projSpeedMod); }
  get abilityCDR()          { return Math.min(0.6, Modifier.eval(this._abilityCDRMod)); }
  get thornsPct()          { return Modifier.eval(this._thornsMod); }
  get aoeMul()             { return Modifier.eval(this._aoeMulMod); }
  get waveGoldInterest()   { return Math.min(0.25, Modifier.eval(this._waveGoldInterestMod)); }
  get multicastChance()    { return Math.min(0.75, Modifier.eval(this._multicastMod)); }
  get abilityDmgMul()     { return Modifier.eval(this._abilityDmgMod); }

  get effectiveSpeed() {
    let s = this.speed;
    if (this.dashActive > 0)  s *= CONFIG.player.dashSpeedMul;
    return s;
  }

  get hitRadius() { return this.r; }

  get isRapidFire() { return (this.powerups['rapid'] ?? 0) > 0; }
  get isTripleShot() { return (this.powerups['triple'] ?? 0) > 0; }
  get fireCooldown() {
    let cd = Math.round(BALANCE.player.fireCooldown * this.cooldownMul);
    if (this.isRapidFire) cd = Math.round(cd * CONFIG.powerups.rapid.effect.cooldownMul);
    return cd;
  }
}

// ============================================================
// ENEMY
// ============================================================
export class Enemy {
  constructor(shapeId, tierId, wave, x, y, world) {
    const sh   = CONFIG.shapes[shapeId];
    const be   = BALANCE.enemies[shapeId] ?? BALANCE.enemies.triangle;
    const tr   = BALANCE.tiers[tierId]    ?? BALANCE.tiers[0];
    const diff = world?.difficulty ?? BALANCE.difficulty.base;

    this.shapeId  = shapeId;
    this.tierId   = tierId;
    this.wave     = wave;
    this.sides    = sh.sides;
    this.r        = sh.r;

    this.color    = tr.color;

    this.speed    = be.speed * CONFIG.player.baseSpeed;
    this.hp       = Math.round(be.hp       * diff);
    this.maxHp    = this.hp;
    this.points   = Math.round(be.points   * tr.rewardMul);
    this.exp      = Math.round(be.exp      * tr.rewardMul * diff);
    this.gold     = Math.round(be.gold     * tr.rewardMul * diff);

    this.contactDamage    = Math.round(be.contactDmg * diff);
    this.onContactEffects = [{ effect: 'damagePlayer', amount: this.contactDamage }];
    this.onDeath          = sh.onDeath ?? [];

    // Behavior
    const bCfg   = sh.behavior;
    this.behaviorId     = bCfg.id;
    this.behaviorParams = { ...bCfg };   // includes range, triggerR, etc.

    // Optional extra behavior overlay (zigzag, shooter, splitter)
    this.extraBehaviorId     = null;
    this.extraBehaviorParams = null;

    // Position
    this.x = x;
    this.y = y;

    // Physics
    this.vx = 0;
    this.vy = 0;

    // Status
    this.freezeTimer = 0;
    this.slowTimer   = 0;
    this.slowFactor  = 1;
    this.t           = 0;    // frame counter for behavior patterns

    // Kamikaze state
    this._fuseActive = false;
    this._fuseTimer  = 0;
    this._flashOn    = false;
  }

  get isDead() { return this.hp <= 0; }
}

// ============================================================
// BULLET (player-fired)
// ============================================================
export class Bullet {
  constructor(x, y, targetAngle, player) {
    const el    = player.elementDef;
    const bmods = el.bulletMods;

    this.x      = x;
    this.y      = y;
    this.angle  = targetAngle;
    this.r      = CONFIG.bullet.r * (bmods.rMul ?? 1);
    this.color  = el.color;
    this.element= player.element;
    this.life   = CONFIG.bullet.life;

    const spd   = CONFIG.bullet.basePx * (bmods.speedMul ?? 1) * player.projectileSpeedMul;
    this.vx     = Math.cos(targetAngle) * spd;
    this.vy     = Math.sin(targetAngle) * spd;

    const base      = player.damage * (bmods.dmgMul ?? 1);
    const variance  = 0.85 + Math.random() * 0.30;
    const rolled    = player.rollDamage(base * variance);
    this.damage     = rolled.damage;
    this.isCrit     = rolled.isCrit;

    this.ownerRef     = player;
    this.pierceLeft   = player.pierce;
    this.onHitEffects = [...(bmods.onHit ?? [])];
    this.shouldDestroy = false;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.life <= 0
      || this.x < -50 || this.x > CONFIG.world.width  + 50
      || this.y < -50 || this.y > CONFIG.world.height + 50) {
      this.shouldDestroy = true;
    }
  }
}

// ============================================================
// ENEMY BULLET (fired by shooters / boss)
// ============================================================
export class EnemyBullet {
  constructor(x, y, ang, damage) {
    const B      = BALANCE.enemyBullet;
    const spd    = CONFIG.bullet.basePx * B.speedMul;
    this.x       = x;
    this.y       = y;
    this.vx      = Math.cos(ang) * spd;
    this.vy      = Math.sin(ang) * spd;
    this.r       = B.r;
    this.damage  = damage ?? B.baseDamage;
    this.color   = B.color;
    this.life    = B.life;
    this.shouldDestroy = false;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.life <= 0
      || this.x < -50 || this.x > CONFIG.world.width  + 50
      || this.y < -50 || this.y > CONFIG.world.height + 50) {
      this.shouldDestroy = true;
    }
  }
}

// ============================================================
// ORB (exp / gold drop)
// ============================================================
export class Orb {
  constructor(x, y, kind, amount) {
    this.x      = x + rand(-10, 10);
    this.y      = y + rand(-10, 10);
    this.kind   = kind;                          // 'exp' | 'gold'
    this.amount = amount;
    this.r      = kind === 'gold' ? 5 : 4;
    this.color  = kind === 'gold' ? '#ffcc33' : '#b366ff';
  }
  update(player) {
    const a = Math.atan2(player.y - this.y, player.x - this.x);
    if (this.magnetized) {
      this.x += Math.cos(a) * 14;
      this.y += Math.sin(a) * 14;
      return;
    }
    const d2 = (this.x - player.x) ** 2 + (this.y - player.y) ** 2;
    if (d2 < CONFIG.drop.pickupRadius ** 2) {
      this.x += Math.cos(a) * CONFIG.drop.pullSpeed;
      this.y += Math.sin(a) * CONFIG.drop.pullSpeed;
    }
  }
  get isDead() { return false; }
}

// ============================================================
// POWERUP DROP (on-ground pickup)
// ============================================================
export class PowerUpDrop {
  constructor(x, y, typeId) {
    this.x      = x;
    this.y      = y;
    this.typeId = typeId;
    this.def    = CONFIG.powerups[typeId];
    this.r      = CONFIG.powerup?.r ?? 10;
    this.life   = CONFIG.powerup?.life ?? 480;
    this.t      = 0;
  }
  update() { this.life--; this.t++; }
  get isDead() { return this.life <= 0; }
}

// ============================================================
// ENVIRONMENTAL OBJECT (barrel, cryo, tesla)
// ============================================================
export class EnvObject {
  constructor(x, y, typeId) {
    this.x       = x;
    this.y       = y;
    this.typeId  = typeId;
    this.def     = CONFIG.envObjects[typeId];
    this.r       = this.def.r;
    this.color   = this.def.color;
    this.zoneActive = false;
    this.zoneTimer  = 0;
    this.zoneRadius = 0;
    this.zoneTick   = null;
    this.shouldDestroy = false;
    this.t = 0;
  }
  update() { this.t++; }
  get isDead() { return this.shouldDestroy && !this.zoneActive; }
}
