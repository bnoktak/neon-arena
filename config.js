// ============================================================
// CONFIG — single source of truth. No logic here, only data.
// To add an enemy shape: add to shapes{}. New element: elements{}.
// New skill: skills{}. New env object: envObjects{}.
// ============================================================

import { BALANCE } from './balance.js';


const _bsQ = {
  id: 'bigshot', name: 'Büyük Mermi', icon: '💥',
  cooldown: BALANCE.bigshot.cooldown,
  params: { damageBonus: BALANCE.bigshot.damage, r: BALANCE.bigshot.r, speedPx: BALANCE.bigshot.speedPx },
};

export const CONFIG = {

  world: { width: 3000, height: 3000 },

  // ---- Camera ----
  camera: { lerpSpeed: 0.10 },

  // ---- Player base stats ----
  player: {
    r: 14,
    baseSpeed:          4.5,
    baseMaxHp:          BALANCE.player.hp,
    baseDamage:         BALANCE.player.damage,
    baseCritChance:     BALANCE.player.critChance,
    baseCritDamagePct:  BALANCE.player.critDmgPct,
    baseLuck:           BALANCE.player.luck,
    baseGoldMul:        BALANCE.player.goldMul,
    baseExpMul:         BALANCE.player.expMul,
    pickupRadius:       BALANCE.player.pickupRadius,
    fireRateCooldown:   BALANCE.player.fireCooldown,
    basePierce:         BALANCE.player.pierce,
    baseLifeSteal:      BALANCE.player.lifeSteal,
    baseBulletCount:    BALANCE.player.bulletCount,
    invulnFrames:       0,
    dashCooldown:       150,
    dashDuration:       12,
    dashSpeedMul:       2.8,
  },

  // ---- Leveling ----
  level: {
    baseReq:      BALANCE.levelUp.expBase,
    reqGrowth:    BALANCE.levelUp.expGrowth,
    dmgPerLevel:  BALANCE.levelUp.damage,
    luckPerLevel: BALANCE.levelUp.luck,
    spPerLevel:   BALANCE.levelUp.sp,
  },

  // ---- Bullet ----
  bullet: {
    basePx:          10,
    r:               4,
    life:            90,
    tripleSpread:    0.28,
  },

  // ---- Projectile on-hit effects (component names + params) ----
  // These are referenced by elements and env objects.
  // The Components system reads these and applies them.
  // No code changes needed to add new effects — just define here.

  // ---- Elements ----
  // passive: applied to player stats at run start
  // bulletMods: applied to every bullet spawned
  // qAbility: the Q-slot active ability definition
  elements: {
    fire: {
      name: 'Fire', icon: '🔥', color: '#ff3333',
      passive: {},
      bulletMods: { rMul: 1.0, speedMul: 1.0, dmgMul: 1.0, onHit: [] },
      qAbility: {
        id: 'fire_q', name: 'FireHalo', icon: '🔥',
        cooldown: BALANCE.elementQ.fire.cooldown,
        params:   { ...BALANCE.elementQ.fire },
      },
      render: { activeQGlow: 0, activeQRings: [] },
    },
    ice: {
      name: 'Ice', icon: '❄️', color: '#3399ff',
      passive: {},
      bulletMods: { rMul: 1.0, speedMul: 1.0, dmgMul: 1.0, onHit: [] },
      qAbility: {
        id: 'ice_q', name: 'Blizzard', icon: '❄️',
        cooldown: BALANCE.elementQ.ice.cooldown,
        params:   { ...BALANCE.elementQ.ice },
      },
      render: {
        activeQGlow: 0,
        activeQRings: [
          { radiusKey: 'radius', color: 'rgba(127,216,248,0.35)', lineWidth: 1.5 },
        ],
      },
    },
    stone: {
      name: 'Stone', icon: '🪨', color: '#888888',
      passive: {},
      bulletMods: { rMul: 1.0, speedMul: 1.0, dmgMul: 1.0, onHit: [] },
      qAbility: {
        id: 'stone_q', name: 'Stone Shield', icon: '🪨',
        cooldown: BALANCE.elementQ.stone.cooldown,
        params:   { ...BALANCE.elementQ.stone },
      },
      render: { activeQGlow: 0, activeQRings: [] },
    },
    lightning: {
      name: 'Lightning', icon: '⚡', color: '#ffffff',
      passive: {},
      bulletMods: { rMul: 1.0, speedMul: 1.0, dmgMul: 1.0, onHit: [] },
      qAbility: {
        id: 'lightning_q', name: 'Thunderstruck', icon: '⚡',
        cooldown: BALANCE.elementQ.lightning.cooldown,
        params:   { ...BALANCE.elementQ.lightning },
      },
      render: { activeQGlow: 28, activeQRings: [] },
    },
    wind: {
      name: 'Wind', icon: '🌪', color: '#ffe600',
      passive: {},
      bulletMods: { rMul: 1.0, speedMul: 1.0, dmgMul: 1.0, onHit: [] },
      qAbility: {
        id: 'wind_q', name: 'Tornado', icon: '🌪',
        cooldown: BALANCE.elementQ.wind.cooldown,
        params:   { ...BALANCE.elementQ.wind },
      },
      render: { activeQGlow: 0, activeQRings: [] },
    },
    toxic: {
      name: 'Toxic', icon: '☠️', color: '#00cc44',
      passive: {},
      bulletMods: { rMul: 1.0, speedMul: 1.0, dmgMul: 1.0, onHit: [] },
      qAbility: {
        id: 'toxic_q', name: 'Toxic Cloud', icon: '☠️',
        cooldown: BALANCE.elementQ.toxic.cooldown,
        params:   { ...BALANCE.elementQ.toxic },
      },
      render: { activeQGlow: 0, activeQRings: [] },
    },
  },

  // ---- Enemy shapes (base stats, 1 unit = CONFIG.player.baseSpeed px/frame) ----
  // behavior: component id that drives movement/special actions
  // onHit: what happens when enemy touches player
  // onDeath: component effects triggered when hp <= 0
  shapes: {
    triangle: {
      label: 'Üçgenler', labelShort: 'üçgen', labelAbbr: 'ÜÇG',
      sides: 3, r: 12,
      behavior: { id: 'chase' },
      onDeath:  [],
      renderHints: { showShooterRing: false, showTurretLock: false },
    },
    square: {
      label: 'Kareler', labelShort: 'kare', labelAbbr: 'KAR',
      sides: 4, r: 15,
      behavior: { id: 'turret', range: 200, fireEvery: 90 },
      onDeath:  [],
      renderHints: { showShooterRing: false, showTurretLock: true },
    },
    pentagon: {
      label: 'Beşgenler', labelShort: 'beşgen', labelAbbr: 'BŞG',
      sides: 5, r: 13,
      behavior: { id: 'kamikaze', triggerR: 150, fuseFrames: 60, explodeR: 100 },
      onDeath:  [{ effect: 'explodePlayer', damageMul: 2.5 }],
      renderHints: { showShooterRing: false, showTurretLock: false },
    },
    hexagon: {
      label: 'Altıgenler', labelShort: 'altıgen', labelAbbr: 'ALT',
      sides: 6, r: 22,
      behavior: { id: 'chase' },
      onDeath:  [{ effect: 'splitSpawn', count: 2, shape: 'triangle' }],
      renderHints: { showShooterRing: false, showTurretLock: false },
    },
  },

  // ---- Color tiers — reward multiplier only, no power scaling ----
  tiers: BALANCE.tiers.map(bt => ({
    rewardMul: bt.rewardMul,
    color:     bt.color,
    label:     bt.label,
  })),

  // ---- Boss (spawns every N waves) ----
  boss: {
    everyWaves: BALANCE.wave.bossEvery,
    r: 44, sides: 6, color: '#ff2d6f',
    baseHp:    BALANCE.boss.baseHp,
    hpPerBoss: BALANCE.boss.hpPerBoss,
    speedUnit: BALANCE.boss.speed,
    points:    BALANCE.boss.points,
    exp:       BALANCE.boss.exp,
    gold:      BALANCE.boss.gold,
    behavior: { id: 'boss', orbitFireR: 220, fireEvery: 55, burst: 5, spread: 0.5 },
    onContact: [{ effect: 'damagePlayer', amount: BALANCE.boss.contactDmg }],
    onDeath:   [],
  },

  // ---- Environmental objects ----
  envObjects: {
    barrel: {
      name: 'Plasma Barrel', icon: '🛢', color: '#ff3355', r: 15,
      spawnWeight: 4,
      trigger:  'bullet',   // triggered when hit by bullet
      onTrigger: [
        { effect: 'aoeExplosion', radius: 150, damage: 80, color: '#ff3355', shake: 14 },
        { effect: 'knockbackAoe', radius: 150, force: 35 },
      ],
    },
    cryo: {
      name: 'Cryo Cube', icon: '🧊', color: '#00f0ff', r: 12,
      spawnWeight: 3,
      trigger: 'bullet',
      onTrigger: [
        { effect: 'aoeExplosion', radius: 180, damage: 20, color: '#00f0ff', shake: 8 },
        { effect: 'freezeAoe',   radius: 180, duration: 120 },
      ],
    },
    tesla: {
      name: 'Tesla Coil', icon: '⚡', color: '#ffe600', r: 10,
      spawnWeight: 3,
      trigger: 'bullet',
      onTrigger: [
        { effect: 'activateZone', radius: 130, duration: 300,
          tickEffect: { effect: 'damageAoeTick', dps: 40, color: '#ffe600' } },
      ],
    },
  },

  // ---- Wave configuration ----
  wave: {
    durationSec:         BALANCE.wave.durationSec,
    maxEnemiesPerWave:   BALANCE.wave.maxEnemies,
    bossEvery:           BALANCE.wave.bossEvery,
    envSpawnIntervalSec: 8.0,
    tierProgression: {
      wavesPerTier:  BALANCE.wave.tierWavesPerTier,
      bossExtraTier: BALANCE.wave.tierBossBonus,
      weights:       BALANCE.wave.tierWeights,
    },
  },

  // ---- Enemy behaviors (referenced by shapes[x].behavior.id) ----
  behaviors: {
    zigzag:   { unlockWave: 2, chance: 0.20, amp: 2.2, freq: 0.08 },
    shooter:  { unlockWave: 4, chance: 0.15, range: 260, fireEvery: 90 },
    splitter: { unlockWave: 6, chance: 0.12 },
  },

  // ---- Difficulty ----
  difficulty: {
    base:            BALANCE.difficulty.base,
    growth:          BALANCE.difficulty.growth,
    marketStep:      BALANCE.difficulty.marketStep,
    marketGoldBonus: BALANCE.difficulty.marketGoldBonus,
    marketExpBonus:  BALANCE.difficulty.marketExpBonus,
  },

  // ---- Drops ----
  drop: {
    pickupRadius:  70,
    pullSpeed:     5,
    orbLife:       Infinity,
    goldChance:    BALANCE.drops.goldChance,
    powerupChance: BALANCE.drops.powerupChance,
    magnetChance:  BALANCE.drops.magnetChance,
  },

  // ---- Power-ups (dropped by enemies) ----
  powerups: {
    heal:   { name: '+15 HP', icon: '+', color: '#00ff88', effect: { healFlat: 15 } },
    magnet: { name: 'Magnet', icon: '🧲', color: '#ff00d4', effect: { magnetPull: true } },
  },

  // ---- Score ----
  score: { survivalPerSec: 2.5 },


  // ---- Market items ----
  // step: amount added per purchase. maxLevel:0 = unlimited.
  shop: {
    priceGrowth: BALANCE.shop.priceGrowth,
    items: [
      { id: 'damage',      category: 'offense',  name: 'Damage',          icon: '⚔',  color: '#00f0ff',
        desc: '+1 damage',           maxLevel: 0,  apply: 'flatDamage',    ...BALANCE.shop.items.damage },
      { id: 'critchance',  category: 'offense',  name: 'Crit Chance',      icon: '◈',  color: '#ff9500',
        desc: '+1% crit chance',     maxLevel: 0,  apply: 'flatCritChance',...BALANCE.shop.items.critchance },
      { id: 'critdmg',     category: 'offense',  name: 'Crit Damage',      icon: '◆',  color: '#ff3355',
        desc: '+1% crit damage',     maxLevel: 0,  apply: 'flatCritDmg',   ...BALANCE.shop.items.critdmg },
      { id: 'firerate',    category: 'offense',  name: 'Fire Rate',        icon: '🔥', color: '#ff6600',
        desc: '+10% fire rate',      maxLevel: 0,  apply: 'flatFireRate',  ...BALANCE.shop.items.firerate },
      { id: 'pierce',      category: 'offense',  name: 'Pierce',           icon: '🏹', color: '#00f0ff',
        desc: '+1 pierce',           maxLevel: 8,  apply: 'flatPierce',    ...BALANCE.shop.items.pierce },
      { id: 'lifesteal',   category: 'offense',  name: 'Life Steal',       icon: '🩸', color: '#ff3355',
        desc: '+3% life steal',      maxLevel: 0,  apply: 'flatLifeSteal', ...BALANCE.shop.items.lifesteal },
      { id: 'bulletcount', category: 'offense',  name: 'Bullet Count',     icon: '🔫', color: '#ffe600',
        desc: '+1 bullet (max 8)',   maxLevel: 7,  apply: 'flatBulletCount',...BALANCE.shop.items.bulletcount },
      { id: 'projspeed',   category: 'offense',  name: 'Bullet Speed',     icon: '➶', color: '#00f0ff',
        desc: '+15% bullet speed',   maxLevel: 0,  apply: 'flatProjSpeed',  ...BALANCE.shop.items.projspeed },
      { id: 'multicast',   category: 'offense',  name: 'Multicast',        icon: '✦',  color: '#ff00d4',
        desc: '+5% multicast chance (max 75%)', maxLevel: 15, apply: 'flatMulticast', ...BALANCE.shop.items.multicast },
      { id: 'maxhp',       category: 'defense',  name: 'Max HP',           icon: '♥',  color: '#ff3355',
        desc: '+5 max HP',           maxLevel: 0,  apply: 'flatMaxHp',     ...BALANCE.shop.items.maxhp },
      { id: 'speed',       category: 'defense',  name: 'Speed',            icon: '➤',  color: '#00ff88',
        desc: '+0.1 speed',          maxLevel: 0,  apply: 'flatSpeed',     ...BALANCE.shop.items.speed },
      { id: 'armor',       category: 'defense',  name: 'Armor',            icon: '🛡', color: '#c8a96e',
        desc: '+1 armor',            maxLevel: 0,  apply: 'flatArmor',     ...BALANCE.shop.items.armor },
      { id: 'regen',       category: 'defense',  name: 'Regen',            icon: '💚', color: '#00ff88',
        desc: '+0.2/s regen',        maxLevel: 0,  apply: 'flatRegen',     ...BALANCE.shop.items.regen },
      { id: 'thornspct',   category: 'defense',  name: 'Thorns',           icon: '⚔', color: '#c8a96e',
        desc: '+5% damage reflection',  maxLevel: 0,  apply: 'flatThorns', ...BALANCE.shop.items.thornspct },
      { id: 'abilitycdr',  category: 'ability',  name: 'Ability CDR',      icon: '⟳', color: '#c9a3ff',
        desc: '+5% ability CDR (max 60%)', maxLevel: 12, apply: 'flatAbilityCDR', ...BALANCE.shop.items.abilitycdr },
      { id: 'aoemul',      category: 'ability',  name: 'AoE Size',         icon: '💥', color: '#ff6600',
        desc: '+2% AoE radius',         maxLevel: 0,  apply: 'flatAoeMul', ...BALANCE.shop.items.aoemul },
      { id: 'abilitydmg',  category: 'ability',  name: 'Ability Damage',   icon: '🔮', color: '#c9a3ff',
        desc: '+10% ability damage',    maxLevel: 0,  apply: 'flatAbilityDmg', ...BALANCE.shop.items.abilitydmg },
      { id: 'luck',        category: 'global',   name: 'Luck',             icon: '✦',  color: '#ffe600',
        desc: '+0.25 luck',          maxLevel: 0,  apply: 'flatLuck',      ...BALANCE.shop.items.luck },
      { id: 'expmul',      category: 'global',   name: 'EXP Multiplier',   icon: '✨', color: '#b366ff',
        desc: '+10% EXP',            maxLevel: 0,  apply: 'flatExpMul',    ...BALANCE.shop.items.expmul },
      { id: 'goldmul',     category: 'global',   name: 'Gold Multiplier',  icon: '⬢',  color: '#ffcc33',
        desc: '+10% gold',           maxLevel: 0,  apply: 'flatGoldMul',   ...BALANCE.shop.items.goldmul },
      { id: 'wavegoldinterest', category: 'global', name: 'Gold Interest',  icon: '💰', color: '#ffcc33',
        desc: '+1% wave end interest (max 25%)', maxLevel: 25, apply: 'flatWaveGoldInterest', ...BALANCE.shop.items.wavegoldinterest },
      { id: 'heal',        category: 'utility',  name: 'Full Heal',        icon: '✚',  color: '#00ff88',
        desc: 'Restore all HP',      consumable: true, apply: 'healFull',  ...BALANCE.shop.items.heal },
      { id: 'difficulty',  category: 'utility',  name: 'Difficulty +',     icon: '☠',  color: '#ff2d6f',
        desc: '+0.25 difficulty · +15% gold · +15% EXP', consumable: true, apply: 'raiseDifficulty', ...BALANCE.shop.items.difficulty },
    ],
  },

  // ---- Ability pool (E and Shift slots — bought in market or skill tree) ----
  // Each ability has: id, name, cooldown, params, applyFn
  abilities: {
    dash: {
      name: 'Dash', icon: '💨', color: '#00f0ff',
      cooldown: 150, duration: 12, params: { speedMul: 2.8, invuln: true },
      marketPrice: 40,
    },
    shield: {
      name: 'Energy Shield', icon: '🛡', color: '#c8a96e',
      cooldown: 300, duration: 90, params: { blockAll: true },
      marketPrice: 60,
    },
    blink: {
      name: 'Blink', icon: '🌀', color: '#c9a3ff',
      cooldown: 240, params: { range: 200 },
      marketPrice: 70,
    },
  },

  // ---- Debug ----
  debug: {
    enabled:  false,
    fastMode: true,   // wave 15s · hp=1 · hızlı level · bol drop · 500 HP
  },

  // ---- VFX / Juice ----
  fx: {
    shakeHitPlayer: 16,
    shakeKillEnemy: 3,
    shakeKillMax:   12,
    shakeBoss:      20,
  },

};
