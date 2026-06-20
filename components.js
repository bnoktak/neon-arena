// ============================================================
// COMPONENTS — every game effect is a named function here.
// Nothing outside this file decides HOW an effect works.
// To add a new effect: add an entry to Effects or Behaviors.
//
// Effects.apply(name, context) — one call applies any effect.
// Behaviors.update(id, entity, target, dt, context) — movement AI.
// ============================================================

import { rand, angle, dist, dist2, clamp, Modifier } from './utils.js';
import { CONFIG } from './config.js';

// ---- Effect context passed into every apply() call ----
// { enemy, player, world, juice, bullets }
// Not all fields are always present — effects use what they need.

export const Effects = {

  // Registry: effectName → handler(params, ctx)
  _registry: {},

  register(name, fn) { this._registry[name] = fn; },

  apply(name, params, ctx) {
    const fn = this._registry[name];
    if (!fn) { console.warn(`[Effects] Unknown effect: "${name}"`); return; }
    return fn(params, ctx);
  },

  // Apply a list of effect descriptors: [{effect, ...params}]
  applyList(list, ctx) {
    list.forEach(desc => {
      const { effect, ...params } = desc;
      this.apply(effect, params, ctx);
    });
  },
};

// ---- Register all built-in effects ----

// Damage player
Effects.register('damagePlayer', ({ amount }, { player, juice, enemy }) => {
  if (!player.tryHit(amount, enemy ?? null)) return;
  juice.shake(CONFIG.fx.shakeHitPlayer);
});

// Slow enemy
Effects.register('slow', ({ factor, duration }, { enemy }) => {
  if (!enemy) return;
  if (enemy.slowTimer < duration) {
    enemy.slowTimer   = duration;
    enemy.slowFactor  = Math.min(enemy.slowFactor ?? 1, factor);
  }
});

// Freeze enemy
Effects.register('freeze', ({ duration }, { enemy }) => {
  if (!enemy) return;
  enemy.freezeTimer = Math.max(enemy.freezeTimer ?? 0, duration);
});

// Knockback enemy
Effects.register('knockback', ({ force }, { enemy, bullet }) => {
  if (!enemy || !bullet) return;
  const a = bullet.angle;
  enemy.vx = (enemy.vx ?? 0) + Math.cos(a) * force;
  enemy.vy = (enemy.vy ?? 0) + Math.sin(a) * force;
});

// Splash: deal damage + sub-effects to nearby enemies
Effects.register('splash', ({ radius, damageMul, subEffects = [] }, { enemy, bullet, world, juice, player }) => {
  if (!enemy || !world) return;
  const finalRadius = radius * (player?.aoeMul ?? 1);
  const toKill = [];
  world.enemies.forEach(e => {
    if (e === enemy || e.hp <= 0) return;
    if (dist(e, enemy) > finalRadius) return;
    e.hp -= (bullet?.damage ?? 0) * damageMul;
    juice?.addExplosion(e.x, e.y, bullet?.color ?? '#fff', 4);
    subEffects.forEach(sub => {
      const { effect, ...params } = sub;
      Effects.apply(effect, params, { enemy: e, bullet, world, juice });
    });
    if (e.hp <= 0) toKill.push(e);
  });
  toKill.forEach(e => {
    juice?.addExplosion(e.x, e.y, e.color, 16);
    world.onKill?.(e);
    world.enemies.splice(world.enemies.indexOf(e), 1);
  });
});

// Lightning chain
Effects.register('chain', ({ targets, falloff }, { enemy: source, bullet, world, juice }) => {
  if (!world || !bullet) return;
  let cur = source;
  let dmg = bullet.damage;
  const visited = new Set([source]);
  for (let i = 0; i < targets; i++) {
    let best = null, bestD = Infinity;
    world.enemies.forEach(e => {
      if (visited.has(e) || e.hp <= 0) return;
      const d = dist2(cur, e);
      if (d < 250*250 && d < bestD) { bestD = d; best = e; }
    });
    if (!best) break;
    dmg *= (1 - falloff);
    best.hp -= dmg;
    juice?.addDmgNumber(best.x, best.y, Math.round(dmg), false, '#ffe033');
    juice?.addExplosion(best.x, best.y, '#ffe033', 3);
    // Visual lightning arc from cur → best
    world._lightningChains?.push({ x1: cur.x, y1: cur.y, x2: best.x, y2: best.y });
    visited.add(best);
    cur = best;
  }
});

// AOE explosion (env objects / Q abilities)
Effects.register('aoeExplosion', ({ radius, damage, color, shake = 0 }, { pos, world, juice, player }) => {
  if (!world || !pos) return;
  const finalRadius = radius * (player?.aoeMul ?? 1);
  const toKill = [];
  world.enemies.forEach(e => {
    if (e.hp <= 0) return;
    if (dist(e, pos) > finalRadius) return;
    e.hp -= damage;
    juice?.addExplosion(e.x, e.y, color, 5);
    juice?.addDmgNumber(e.x, e.y, damage, false, color);
    if (e.hp <= 0) toKill.push(e);
  });
  juice?.addExplosion(pos.x, pos.y, color, 25);
  if (shake) juice?.shake(shake);
  toKill.forEach(e => {
    juice?.addExplosion(e.x, e.y, e.color, 16);
    world.onKill?.(e);
    world.enemies.splice(world.enemies.indexOf(e), 1);
  });
});

// Knockback AOE
Effects.register('knockbackAoe', ({ radius, force }, { pos, world, player }) => {
  if (!world || !pos) return;
  const finalRadius = radius * (player?.aoeMul ?? 1);
  world.enemies.forEach(e => {
    if (dist(e, pos) > finalRadius) return;
    const a = Math.atan2(e.y - pos.y, e.x - pos.x);
    e.vx = (e.vx ?? 0) + Math.cos(a) * force;
    e.vy = (e.vy ?? 0) + Math.sin(a) * force;
  });
});

// Freeze AOE
Effects.register('freezeAoe', ({ radius, duration }, { pos, world, player }) => {
  if (!world || !pos) return;
  const finalRadius = radius * (player?.aoeMul ?? 1);
  world.enemies.forEach(e => {
    if (dist(e, pos) > finalRadius) return;
    e.freezeTimer = Math.max(e.freezeTimer ?? 0, duration);
  });
});

// Activate zone (tesla coil style — sets active zone on env object)
Effects.register('activateZone', ({ radius, duration, tickEffect }, { envObj }) => {
  if (!envObj) return;
  envObj.zoneActive   = true;
  envObj.zoneRadius   = radius;
  envObj.zoneTimer    = duration;
  envObj.zoneTick     = tickEffect;
  envObj.r            = radius;
});

// Damage AOE per tick (used by zone tick)
Effects.register('damageAoeTick', ({ dps, color }, { pos, world, juice, dt }) => {
  if (!world || !pos) return;
  const toKill = [];
  world.enemies.forEach(e => {
    if (e.hp <= 0) return;
    if (dist(e, pos) > (pos.zoneRadius ?? pos.r ?? 0)) return;
    const dmg = dps * dt;
    e.hp -= dmg;
    if (Math.random() < 0.15) juice?.addExplosion(e.x, e.y, color, 1);
    if (e.hp <= 0) toKill.push(e);
  });
  toKill.forEach(e => {
    juice?.addExplosion(e.x, e.y, e.color, 16);
    world.onKill?.(e);
    world.enemies.splice(world.enemies.indexOf(e), 1);
  });
});

// AOE explosion on death
// Pentagon patlaması — sadece oyuncuya hasar verir
Effects.register('explodePlayer', ({ damageMul }, { enemy: source, player, juice }) => {
  if (!source || !player) return;
  const dmg = source.contactDamage * damageMul;
  player.tryHit(dmg, null);
  juice?.addExplosion(source.x, source.y, '#ff3355', 30);
  juice?.shake(12);
});

Effects.register('explodeAoe', ({ radius, damageMul }, { enemy: source, world, juice }) => {
  if (!world || !source) return;
  const dmg = (source.hp ?? 0) + source.contactDamage * damageMul;
  world.enemies.forEach(e => {
    if (e === source || e.hp <= 0) return;
    if (dist(e, source) > radius) return;
    e.hp -= dmg;
    juice?.addExplosion(e.x, e.y, '#ff3355', 6);
  });
  juice?.addExplosion(source.x, source.y, '#ff3355', 30);
  juice?.shake(12);
});

// Split spawn on death
Effects.register('splitSpawn', ({ count, shape }, { enemy: source, world }) => {
  if (!world || !source) return;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    world.spawnEnemy(shape, source.tierId ?? 0, source.wave,
      source.x + Math.cos(a) * 20,
      source.y + Math.sin(a) * 20);
  }
});

// Player damage shield (demir deri)
Effects.register('activateDamageShield', ({ duration }, { player }) => {
  if (!player) return;
  player.damageShieldTimer = duration;
});

// Heal player
Effects.register('healFlat', ({ amount }, { player }) => {
  if (!player) return;
  player.hp = Math.min(player.maxHp, player.hp + amount);
});

// ============================================================
// BEHAVIORS — movement and special AI patterns.
// Each has: update(entity, target, dt, ctx) → may push bullets
// ============================================================

export const Behaviors = {

  _registry: {},

  register(id, fn) { this._registry[id] = fn; },

  update(id, entity, target, dt, ctx) {
    const fn = this._registry[id];
    if (!fn) return;
    fn(entity, target, dt, ctx);
  },
};

// ---- Chase ----
Behaviors.register('chase', (e, target, dt) => {
  const spd = e.speed * (e.slowFactor ?? 1);
  const a   = Math.atan2(target.y - e.y, target.x - e.x);
  e.x += Math.cos(a) * spd;
  e.y += Math.sin(a) * spd;
});

// ---- Strafe ----
Behaviors.register('strafe', (e, target, dt) => {
  const spd  = e.speed * (e.slowFactor ?? 1);
  const d    = dist(e, target);
  const rng  = e.behaviorParams.range;
  if (d > rng + 20) {
    const a = Math.atan2(target.y - e.y, target.x - e.x);
    e.x += Math.cos(a) * spd;
    e.y += Math.sin(a) * spd;
  } else if (d < rng - 20) {
    const a = Math.atan2(target.y - e.y, target.x - e.x);
    e.x -= Math.cos(a) * spd * 0.5;
    e.y -= Math.sin(a) * spd * 0.5;
  } else {
    e._strafeAngle = (e._strafeAngle ?? 0) + spd * 0.012;
    const tx = target.x + Math.cos(e._strafeAngle) * rng;
    const ty = target.y + Math.sin(e._strafeAngle) * rng;
    const a  = Math.atan2(ty - e.y, tx - e.x);
    e.x += Math.cos(a) * spd;
    e.y += Math.sin(a) * spd;
  }
});

// ---- Kamikaze ----
Behaviors.register('kamikaze', (e, target, dt, ctx) => {
  const spd = e.speed * (e.slowFactor ?? 1);
  const { triggerR, fuseFrames, explodeR } = e.behaviorParams;
  const a   = Math.atan2(target.y - e.y, target.x - e.x);

  // Her zaman kovala
  e.x += Math.cos(a) * spd;
  e.y += Math.sin(a) * spd;

  if (!e._fuseActive) {
    if (dist(e, target) <= triggerR) {
      e._fuseActive = true;
      e._fuseTimer  = fuseFrames;
    }
  } else {
    e._flashOn = Math.floor(e._fuseTimer / 6) % 2 === 0;
    e._fuseTimer--;

    if (e._fuseTimer <= 0) {
      Effects.applyList(e.onDeath, { enemy: e, world: ctx.world, juice: ctx.juice });
      if (dist(e, target) <= explodeR) {
        target.tryHit(e.contactDamage * 2);
      }
      e.hp = 0;
    }
  }
});

// ---- Boss ----
Behaviors.register('boss', (e, target, dt, ctx) => {
  const spd = e.speed * (e.slowFactor ?? 1);
  const { orbitFireR, fireEvery, burst, spread } = e.behaviorParams;
  const d   = dist(e, target);
  const a   = Math.atan2(target.y - e.y, target.x - e.x);
  // keep medium distance
  const dir = d > orbitFireR ? 1 : (d < orbitFireR - 40 ? -0.5 : 0);
  e.x += Math.cos(a) * spd * dir;
  e.y += Math.sin(a) * spd * dir;
  // orbit drift
  e.x += Math.cos(a + Math.PI/2) * spd * 0.5;
  e.y += Math.sin(a + Math.PI/2) * spd * 0.5;
  e.x = clamp(e.x, e.r, CONFIG.world.width  - e.r);
  e.y = clamp(e.y, e.r, CONFIG.world.height - e.r);

  e._fireTimer = (e._fireTimer ?? 0) + 1;
  if (e._fireTimer >= fireEvery) {
    e._fireTimer = 0;
    const shots = [];
    for (let i = 0; i < burst; i++) {
      const off = (i / (burst - 1) - 0.5) * spread;
      shots.push({ x: e.x, y: e.y, angle: a + off });
    }
    ctx.spawnEnemyBullets?.(shots, e);
  }
});

// ---- Zigzag ----
Behaviors.register('zigzag', (e, target, dt) => {
  const spd = e.speed * (e.slowFactor ?? 1);
  const a   = Math.atan2(target.y - e.y, target.x - e.x);
  const { amp = 2.2, freq = 0.08 } = e.behaviorParams ?? {};
  const perp = a + Math.PI / 2;
  const wob  = Math.sin((e.t ?? 0) * freq) * amp;
  e.x += Math.cos(a) * spd + Math.cos(perp) * wob;
  e.y += Math.sin(a) * spd + Math.sin(perp) * wob;
});

// ---- Shooter ----
Behaviors.register('shooter', (e, target, dt, ctx) => {
  const spd = e.speed * (e.slowFactor ?? 1);
  const { range, fireEvery } = e.behaviorParams;
  const d   = dist(e, target);
  const a   = Math.atan2(target.y - e.y, target.x - e.x);
  if (d > range) {
    e.x += Math.cos(a) * spd;
    e.y += Math.sin(a) * spd;
  } else {
    // strafe slightly
    const perp = a + Math.PI / 2;
    e.x += Math.cos(perp) * spd * 0.4 * Math.sin((e.t ?? 0) * 0.05);
    e.y += Math.sin(perp) * spd * 0.4 * Math.sin((e.t ?? 0) * 0.05);
    e._fireTimer = (e._fireTimer ?? 0) + 1;
    if (e._fireTimer >= fireEvery) {
      e._fireTimer = 0;
      ctx.spawnEnemyBullets?.([{ x: e.x, y: e.y, angle: a }], e);
    }
  }
});

Behaviors.register('turret', (e, target, dt, ctx) => {
  const spd = e.speed * (e.slowFactor ?? 1);
  if (!e._locked) {
    const d = dist(e, target);
    if (d <= e.behaviorParams.range) {
      e._locked = true;
    } else {
      const a = Math.atan2(target.y - e.y, target.x - e.x);
      e.x += Math.cos(a) * spd;
      e.y += Math.sin(a) * spd;
    }
  }
  if (e._locked) {
    e._fireTimer = (e._fireTimer ?? 0) + 1;
    if (e._fireTimer >= e.behaviorParams.fireEvery && e.hp > 0) {
      e._fireTimer = 0;
      const a = Math.atan2(target.y - e.y, target.x - e.x);
      ctx.spawnEnemyBullets?.([{ x: e.x, y: e.y, angle: a }], e);
    }
    e.x += (Math.random() - 0.5) * 0.3;
    e.y += (Math.random() - 0.5) * 0.3;
  }
});

// ============================================================
// SKILL EFFECTS — applied when a skill is learned / leveled
// Referenced by CONFIG.skillTree[x].apply string
// ============================================================

export const SkillEffects = {
  flatFireRate:    (player, step) => { Modifier.addFlat(player._cooldownMod,    -step); },
  flatDamage:      (player, step) => { Modifier.addFlat(player._damageMod,       step); },
  flatMaxHp:       (player, step) => { Modifier.addFlat(player._maxHpMod,        step); player.hp = Math.min(player.hp + step, Modifier.eval(player._maxHpMod)); },
  flatSpeed:       (player, step) => { Modifier.addFlat(player._speedMod,        step * CONFIG.player.baseSpeed); },
  flatLuck:        (player, step) => { Modifier.addFlat(player._luckMod,         step); },
  flatCritChance:  (player, step) => { Modifier.addFlat(player._critChanceMod,   step); },
  flatCritDmg:     (player, step) => { Modifier.addFlat(player._critDmgMod,      step); },
  flatPierce:      (player, step) => { Modifier.addFlat(player._pierceMod,       step); },
  flatLifeSteal:   (player, step) => { Modifier.addFlat(player._lifeStealMod,    step); },
  flatBulletCount: (player, step) => { Modifier.addFlat(player._bulletCountMod,  step); },
  flatExpMul:      (player, step) => { Modifier.addFlat(player._expMulMod,       step); },
  flatGoldMul:     (player, step) => { Modifier.addFlat(player._goldMulMod,      step); },
  flatArmor:       (player, step) => { Modifier.addFlat(player._armorMod,        step); },
  flatRegen:       (player, step) => { Modifier.addFlat(player._regenMod,        step); },
  flatProjSpeed:   (player, step) => { Modifier.addFlat(player._projSpeedMod,    step); },
  flatAbilityCDR:  (player, step) => { Modifier.addFlat(player._abilityCDRMod,   step); },
  flatThorns:            (player, step) => { Modifier.addFlat(player._thornsMod,            step); },
  flatAoeMul:            (player, step) => { Modifier.addFlat(player._aoeMulMod,            step); },
  flatWaveGoldInterest:  (player, step) => { Modifier.addFlat(player._waveGoldInterestMod,  step); },
  flatMulticast:         (player, step) => { Modifier.addFlat(player._multicastMod,         step); },
  flatAbilityDmg:        (player, step) => { Modifier.addFlat(player._abilityDmgMod,        step); },
  healFull:       (player)       => { player.hp = player.maxHp; },
  raiseDifficulty:(player) => {
    player._marketDiffBonus += CONFIG.difficulty.marketStep;
    Modifier.addFlat(player._goldMulMod, Modifier.eval(player._goldMulMod) * CONFIG.difficulty.marketGoldBonus);
    Modifier.addFlat(player._expMulMod,  Modifier.eval(player._expMulMod)  * CONFIG.difficulty.marketExpBonus);
  },
};

// ============================================================
// ABILITY HANDLERS — her yetenek buraya register edilir.
// AbilitySystem sadece execute() çağırır, if-else içermez.
// Yeni yetenek eklemek = sadece buraya register() çağrısı.
// ============================================================

import { Bullet } from './entities.js';

export const AbilityHandlers = {
  _registry: {},

  register(id, fn) { this._registry[id] = fn; },

  execute(ability, player, world, juice) {
    const fn = this._registry[ability.id];
    if (!fn) {
      console.warn(`[AbilityHandlers] Bilinmeyen yetenek: "${ability.id}"`);
      return;
    }
    fn(ability, player, world, juice);
  },
};

// ---- Bigshot ----
AbilityHandlers.register('bigshot', (ability, player, world, juice) => {
  const { damageBonus, r, speedPx } = ability.params;
  const b = new Bullet(player.x, player.y, player.angle, player);
  b.damage = damageBonus + player.damage;
  b.r      = r;
  b.vx     = Math.cos(player.angle) * speedPx;
  b.vy     = Math.sin(player.angle) * speedPx;
  b.color  = player.elementDef.color;
  world.bullets.push(b);
  juice.addExplosion(player.x, player.y, player.elementDef.color, 10);
});

// ---- Stone Q ----
AbilityHandlers.register('stone_q', (ability, player, world, juice) => {
  const p     = ability.params;
  const count = p.orbitCount;
  player.orbits = Array.from({ length: count }, (_, i) => ({
    angle:        (i / count) * Math.PI * 2,
    alive:        true,
    respawnTimer: 0,
    r:            10,
    damage:       p.damage,
    knockback:    p.knockback,
    orbitR:       p.orbitR,
    orbitSpeed:   p.orbitSpeed,
    color:        p.color,
    duration:     p.duration,
    timer:        p.duration,
  }));
  juice.addExplosion(player.x, player.y, p.color, 15);
  juice.shake(8);
});

AbilityHandlers.register('wind_q', (ability, player, world, juice) => {
  const p  = ability.params;
  const tx = world._mouseWorld?.x ?? player.x;
  const ty = world._mouseWorld?.y ?? player.y;
  world._activeZones = world._activeZones ?? [];
  world._activeZones.push({
    type:      'wind',
    x:         tx,
    y:         ty,
    radius:    p.radius * (player.aoeMul ?? 1),
    dps:       p.dps,
    duration:  p.duration,
    timer:     p.duration,
    pullForce: p.pullForce,
    color:     p.color,
    owner:     null,
  });
  juice.addExplosion(tx, ty, p.color, 20);
  juice.shake(6);
});

AbilityHandlers.register('lightning_q', (ability, player, world, juice) => {
  const p = ability.params;
  const tx = world._mouseWorld?.x ?? player.x;
  const ty = world._mouseWorld?.y ?? player.y;
  world._activeZones = world._activeZones ?? [];
  world._activeZones.push({
    type:     'lightning',
    x:        tx,
    y:        ty,
    radius:   p.radius * (player.aoeMul ?? 1),
    dps:      p.dps,
    duration: p.duration,
    timer:    p.duration,
    stunDur:  p.stunDur,
    color:    p.color,
    owner:    null,
  });
  juice.addExplosion(tx, ty, p.color, 25);
  juice.shake(10);
});

// ---- Dash ----
AbilityHandlers.register('dash', (ability, player, world, juice) => {
  player.dashActive = ability.params.duration ?? CONFIG.player.dashDuration;
  if (ability.params.invuln) player.invulnTimer = player.dashActive;
  juice.addExplosion(player.x, player.y, '#ffffff', 8);
});

// ---- Shield ----
AbilityHandlers.register('shield', (ability, player, world, juice) => {
  player.damageShieldTimer = ability.params.duration ?? 90;
});

// ---- Blink ----
AbilityHandlers.register('blink', (ability, player, world, juice) => {
  const a   = player.angle;
  const rng = ability.params.range ?? 200;
  player.x  = clamp(player.x + Math.cos(a) * rng, player.r, CONFIG.world.width  - player.r);
  player.y  = clamp(player.y + Math.sin(a) * rng, player.r, CONFIG.world.height - player.r);
  juice.addExplosion(player.x, player.y, '#c9a3ff', 12);
});

AbilityHandlers.register('ice_q', (ability, player, world, juice) => {
  const p = ability.params;
  world._activeZones = world._activeZones ?? [];
  world._activeZones.push({
    type:       'ice',
    x:          player.x,
    y:          player.y,
    radius:     p.radius * (player.aoeMul ?? 1),
    dps:        p.dps,
    duration:   p.duration,
    timer:      p.duration,
    color:      p.color,
    slowFactor: p.slowFactor,
    owner:      player,
  });
  juice.addExplosion(player.x, player.y, p.color, 20);
  juice.shake(6);
});

AbilityHandlers.register('toxic_q', (ability, player, world, juice) => {
  const p = ability.params;
  world._activeZones = world._activeZones ?? [];
  world._activeZones.push({
    type:     'toxic',
    x:        player.x,
    y:        player.y,
    radius:   p.radius * (player.aoeMul ?? 1),
    dps:      p.dps,
    duration: p.duration,
    timer:    p.duration,
    color:    p.color,
    owner:    player,
  });
  juice.addExplosion(player.x, player.y, p.color, 20);
  juice.shake(6);
});

AbilityHandlers.register('fire_q', (ability, player, world, juice) => {
  const p = ability.params;
  world._activeZones = world._activeZones ?? [];
  world._activeZones.push({
    type:     'fire',
    x:        player.x,
    y:        player.y,
    radius:   p.radius * (player.aoeMul ?? 1),
    dps:      p.dps,
    duration: p.duration,
    timer:    p.duration,
    color:    p.color,
    owner:    player,
  });
  juice.addExplosion(player.x, player.y, p.color, 20);
  juice.shake(8);
});
