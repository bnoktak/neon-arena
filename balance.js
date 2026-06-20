// ============================================================
// BALANCE — single source of truth for all numerical values.
// No logic here, only numbers. Import from config.js,
// entities.js, systems.js, or game.js as needed.
// ============================================================

export const BALANCE = {

  player: {
    hp:           100,
    damage:       10,
    speed:        1.0,    // units — actual px = speed * CONFIG.player.baseSpeed
    critChance:   1,
    critDmgPct:   1,
    luck:         1.0,
    goldMul:      1.0,
    expMul:       1.0,
    pickupRadius: 80,
    pierce:       0,
    lifeSteal:    0,
    bulletCount:  1,
    fireCooldown: 30,
    armor:              0,
    regenPerSec:        1,
    projectileSpeedMul: 1.0,
    abilityCDR:         0.0,
    thornsPct:          0.0,
    aoeMul:             1.0,
    waveGoldInterest:   0.0,
    multicastChance:    0.0,
    abilityDmgMul:      1.0,
  },

  levelUp: {
    damage:    0,
    luck:      0,
    sp:        0,
    expBase:   10,
    expGrowth: 10,
  },

  enemies: {
    triangle: { hp: 10, speed: 0.55, contactDmg: 8,  exp: 1, gold: 1, points: 1, spawnWeight: 50, minWeight: 20, maxWeight: 70 },
    square:   { hp: 20, speed: 0.35, contactDmg: 5,  exp: 2, gold: 2, points: 2, spawnWeight: 25, minWeight: 10, maxWeight: 40 },
    pentagon: { hp: 15, speed: 0.70, contactDmg: 20, exp: 3, gold: 3, points: 3, spawnWeight: 15, minWeight: 5,  maxWeight: 30 },
    hexagon:  { hp: 40, speed: 0.28, contactDmg: 12, exp: 5, gold: 5, points: 5, spawnWeight: 10, minWeight: 5,  maxWeight: 20 },
  },

  tiers: [
    { color: '#aaaaaa', label: 'T1', rewardMul: 1.0, minWeight: 40, maxWeight: 80 },
    { color: '#3399ff', label: 'T2', rewardMul: 1.5, minWeight: 15, maxWeight: 50 },
    { color: '#ffe600', label: 'T3', rewardMul: 2.0, minWeight: 5,  maxWeight: 25 },
    { color: '#ff3355', label: 'T4', rewardMul: 2.5, minWeight: 2,  maxWeight: 15 },
    { color: '#cc44ff', label: 'T5', rewardMul: 3.0, minWeight: 1,  maxWeight: 8  },
    { color: '#00ff88', label: 'T6', rewardMul: 5.0, minWeight: 1,  maxWeight: 5  },
  ],

  luck: {
    cap: 10.0,
  },

  boss: {
    baseHp:    50,
    hpPerBoss: 25,
    speed:     0.40,
    contactDmg: 20,
    exp:       50,
    gold:      30,
    points:    100,
  },

  levelUpCards: {
    pool: [
      // 🛡 Defense
      { id: 'card_maxhp',    category: 'savunma',  icon: '♥',  name: 'Max HP',          desc: '+10 maximum HP',              stat: 'flatMaxHp',    step: 10  },
      { id: 'card_armor',    category: 'savunma',  icon: '🛡',  name: 'Armor',           desc: '+2 armor',                    stat: 'flatArmor',    step: 2   },
      { id: 'card_regen',    category: 'savunma',  icon: '💚',  name: 'Regeneration',    desc: '+1 HP/s regeneration',        stat: 'flatRegen',    step: 1   },
      { id: 'card_thorns',   category: 'savunma',  icon: '⚔',  name: 'Thorns',          desc: '+5% damage reflection',       stat: 'flatThorns',   step: 0.05},

      // ⚔ Offense
      { id: 'card_damage',   category: 'saldiri',  icon: '⚔',  name: 'Damage',          desc: '+3 damage',                   stat: 'flatDamage',   step: 3   },
      { id: 'card_crit',     category: 'saldiri',  icon: '◈',  name: 'Crit Chance',     desc: '+5% crit chance',             stat: 'flatCritChance',step: 5  },
      { id: 'card_critdmg',  category: 'saldiri',  icon: '◆',  name: 'Crit Damage',     desc: '+10% crit damage',            stat: 'flatCritDmg',  step: 10  },
      { id: 'card_pierce',   category: 'saldiri',  icon: '🏹',  name: 'Pierce',          desc: '+1 pierce',                   stat: 'flatPierce',   step: 1   },
      { id: 'card_lifesteal',category: 'saldiri',  icon: '🩸',  name: 'Life Steal',      desc: '+3% life steal',              stat: 'flatLifeSteal',step: 0.03},
      { id: 'card_bullets',  category: 'saldiri',  icon: '🔫',  name: 'Bullet Count',    desc: '+1 bullet',                   stat: 'flatBulletCount',step: 1 },
      { id: 'card_firerate', category: 'saldiri',  icon: '🔥',  name: 'Fire Rate',       desc: '+10% fire rate',              stat: 'flatFireRate', step: 0.10},
      { id: 'card_projspeed',category: 'saldiri',  icon: '➶',  name: 'Bullet Speed',    desc: '+15% bullet speed',           stat: 'flatProjSpeed',step: 0.15},
      { id: 'card_multicast',category: 'saldiri',  icon: '✦',  name: 'Multicast',       desc: '+5% multicast chance',        stat: 'flatMulticast',step: 0.05},

      // ✨ Ability
      { id: 'card_abilitycdr', category: 'yetenek', icon: '⟳', name: 'Ability CDR',     desc: '+5% ability cooldown reduction', stat: 'flatAbilityCDR', step: 0.05},
      { id: 'card_aoemul',     category: 'yetenek', icon: '💥', name: 'AoE Size',        desc: '+5% AoE radius',              stat: 'flatAoeMul',     step: 0.05},
      { id: 'card_abilitydmg', category: 'yetenek', icon: '🔮', name: 'Ability Damage',  desc: '+10% ability damage',         stat: 'flatAbilityDmg', step: 0.10},

      // 💰 Global
      { id: 'card_goldmul',  category: 'global',   icon: '⬢',  name: 'Gold Multiplier', desc: '+10% gold',                   stat: 'flatGoldMul',  step: 0.10},
      { id: 'card_expmul',   category: 'global',   icon: '✨',  name: 'EXP Multiplier',  desc: '+10% EXP',                    stat: 'flatExpMul',   step: 0.10},
      { id: 'card_luck',     category: 'global',   icon: '✦',  name: 'Luck',            desc: '+0.5 luck',                   stat: 'flatLuck',     step: 0.5 },
      { id: 'card_interest', category: 'global',   icon: '💰',  name: 'Gold Interest',   desc: '+2% wave end interest',       stat: 'flatWaveGoldInterest', step: 0.02},
      { id: 'card_difficulty',category: 'global',  icon: '☠',  name: 'Difficulty +',    desc: '+0.25 difficulty · +15% rewards', stat: 'raiseDifficulty', step: 0 },
    ],
  },

  elementQ: {
    fire: {
      cooldown:  480,
      radius:    150,
      duration:  240,
      dps:       20,
      color:     '#ff3333',
    },
    ice: {
      cooldown:  480,
      radius:    150,
      duration:  240,
      dps:       10,
      slowFactor: 0.5,
      color:     '#3399ff',
    },
    lightning: {
      cooldown:  480,
      radius:    120,
      duration:  240,
      dps:       15,
      stunDur:   30,
      color:     '#ffffff',
    },
    stone: {
      cooldown:  480,
      duration:  300,
      orbitCount: 5,
      orbitR:    80,
      orbitSpeed: 0.04,
      damage:    15,
      knockback: 12,
      color:     '#888888',
    },
    wind: {
      cooldown:  480,
      radius:    180,
      duration:  240,
      dps:       8,
      pullForce: 3,
      color:     '#ffe600',
    },
    toxic: {
      cooldown:  480,
      radius:    160,
      duration:  240,
      dps:       25,
      color:     '#00cc44',
    },
  },

  enemyBullet: {
    baseDamage: 7,
    speedMul:   0.6,
    r:          5,
    life:       240,
    color:      '#ff5bdc',
  },

  wave: {
    durationSec:            60,
    maxEnemies:             200,
    bossEvery:              5,
    tierWavesPerTier:       2,
    tierBossBonus:          1,
    tierWeights:            [70, 20, 7, 2, 0.7, 0.3],
    clearBonusMultiplier:   10,
    clearBonusOrbCount:     5,
  },

  difficulty: {
    base:            1.0,
    growth:          1.08,   // per-wave multiplier: base * growth^(wave-1)
    marketStep:      0.25,
    marketGoldBonus: 0.15,
    marketExpBonus:  0.15,
  },

  shop: {
    priceGrowth: 1.6,
    items: {
      damage:      { basePrice: 10, step: 1     },
      maxhp:       { basePrice: 8,  step: 5     },
      speed:       { basePrice: 12, step: 0.1   },
      critchance:  { basePrice: 15, step: 1     },
      critdmg:     { basePrice: 15, step: 1     },
      firerate:    { basePrice: 12, step: 0.10  },
      luck:        { basePrice: 10, step: 0.25  },
      pierce:      { basePrice: 20, step: 1     },
      lifesteal:   { basePrice: 25, step: 0.03  },
      bulletcount: { basePrice: 40, step: 1     },
      expmul:      { basePrice: 15, step: 0.10  },
      goldmul:     { basePrice: 15, step: 0.10  },
      heal:        { basePrice: 5              },
      difficulty:  { basePrice: 20             },
      armor:       { basePrice: 12, step: 1    },
      regen:       { basePrice: 18, step: 0.2  },
      projspeed:   { basePrice: 14, step: 0.15 },
      abilitycdr:  { basePrice: 20, step: 0.05 },
      thornspct:        { basePrice: 16, step: 0.05 },
      aoemul:           { basePrice: 18, step: 0.02 },
      wavegoldinterest: { basePrice: 15, step: 0.01 },
      multicast:        { basePrice: 35, step: 0.05 },
      abilitydmg:       { basePrice: 18, step: 0.10 },
    },
  },

  drops: {
    goldChance:    0.50,
    powerupChance: 0.0,
    magnetChance:  0.01,
  },

  bigshot: {
    cooldown:    180,
    damage:      20,
    r:           18,
    speedPx:     12,
  },

};
