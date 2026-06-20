// ============================================================
// RENDERER — owns the canvas. Reads world state, draws it.
// No game logic. Camera + all draw calls live here.
// ============================================================

import { CONFIG }       from './config.js';
import { BALANCE }      from './balance.js';
import { polygonPath }  from './utils.js';
import { Juice }        from './juice.js';

// ---- Lightning chain visual state ----
// Stored here so it can be rendered this frame after collision resolves
export const LightningVFX = {
  chains: [],   // [{x1,y1,x2,y2,alpha}]
  add(x1, y1, x2, y2) {
    this.chains.push({ x1, y1, x2, y2, alpha: 1.0 });
  },
  update() {
    this.chains = this.chains.filter(c => { c.alpha -= 0.08; return c.alpha > 0; });
  },
};

// ---- Ice Q burst visual state ----
export const IceVFX = {
  bursts: [],   // [{x,y,r,maxR,alpha}]
  trigger(x, y, innerR, outerR) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.bursts.push({ x, y, a, r: 0, maxR: outerR * (0.6 + Math.random() * 0.5), alpha: 1.0 });
    }
    // Two expanding rings
    this.bursts.push({ x, y, ring: true, r: 0, maxR: innerR, alpha: 1.0, color: '#b3f5ff' });
    this.bursts.push({ x, y, ring: true, r: 0, maxR: outerR,  alpha: 1.0, color: '#7fd8f8' });
  },
  update() {
    this.bursts = this.bursts.filter(b => {
      b.r     += b.maxR * 0.06;
      b.alpha -= 0.04;
      return b.alpha > 0 && b.r < b.maxR * 1.1;
    });
  },
};

// ============================================================
// CAMERA
// ============================================================
const Camera = {
  x: 0, y: 0, w: 0, h: 0,

  update(targetX, targetY, shakeOff) {
    const lp = CONFIG.camera.lerpSpeed;
    const tx = Math.max(0, Math.min(CONFIG.world.width  - this.w, targetX - this.w / 2));
    const ty = Math.max(0, Math.min(CONFIG.world.height - this.h, targetY - this.h / 2));
    this.x = this.x + (tx - this.x) * lp + shakeOff.dx;
    this.y = this.y + (ty - this.y) * lp + shakeOff.dy;
  },

  toScreen(wx, wy) { return { x: wx - this.x, y: wy - this.y }; },
};

// ============================================================
// RENDERER
// ============================================================
export const Renderer = {
  canvas: null,
  ctx:    null,

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    Camera.w = this.canvas.width;
    Camera.h = this.canvas.height;
  },

  updateCamera(player, shakeOff) {
    Camera.update(player.x, player.y, shakeOff);
  },

  draw(player, world, input, game) {
    const ctx = this.ctx;

    // Tick VFX
    LightningVFX.update();
    IceVFX.update();

    ctx.fillStyle = '#0d0e12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawGrid(ctx);
    this._drawEnvObjects(ctx, world);
    this._drawActiveZones(ctx, world);
    this._drawOrbs(ctx, world);
    this._drawPowerUpDrops(ctx, world);
    this._drawIceVFX(ctx);
    this._drawEnemyBullets(ctx, world);
    this._drawBullets(ctx, world);
    this._drawEnemies(ctx, world);
    this._drawLightningVFX(ctx);
    this._drawStoneOrbits(ctx, player);
    this._drawPlayer(ctx, player);
    Juice.drawParticles(ctx, Camera.x, Camera.y);
    Juice.drawDmgNumbers(ctx, Camera.x, Camera.y);
    Juice.drawPickupTexts(ctx, Camera.x, Camera.y);
    this._drawHUD(ctx, player, world);
    if (game?._debugMode) this._drawDebugOverlay(ctx, player, world);
  },

  _drawGrid(ctx) {
    const size = 80;
    const ox   = -Camera.x % size;
    const oy   = -Camera.y % size;
    ctx.strokeStyle = '#1a1e28';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (let x = ox; x < this.canvas.width; x += size)  { ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); }
    for (let y = oy; y < this.canvas.height; y += size) { ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); }
    ctx.stroke();

    // Dark overlay outside world boundary
    const wx = -Camera.x, wy = -Camera.y;
    const ww = CONFIG.world.width, wh = CONFIG.world.height;
    const cw = this.canvas.width,  ch = this.canvas.height;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    if (wy > 0)        ctx.fillRect(0, 0, cw, wy);
    if (wy + wh < ch)  ctx.fillRect(0, wy + wh, cw, ch - (wy + wh));
    if (wx > 0)        ctx.fillRect(0, wy, wx, wh);
    if (wx + ww < cw)  ctx.fillRect(wx + ww, wy, cw - (wx + ww), wh);

    // World border — bright thick line
    ctx.strokeStyle = '#ff335599';
    ctx.lineWidth   = 4;
    ctx.strokeRect(wx, wy, ww, wh);
  },

  _drawEnvObjects(ctx, world) {
    world.envObjects.forEach(obj => {
      const s = Camera.toScreen(obj.x, obj.y);
      if (obj.zoneActive) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, obj.zoneRadius, 0, Math.PI * 2);
        ctx.fillStyle   = 'rgba(255,230,0,0.07)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,230,0,0.35)';
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, obj.def.r, 0, Math.PI * 2);
      ctx.fillStyle   = obj.color;
      ctx.shadowColor = obj.color;
      ctx.shadowBlur  = 12;
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.font        = '14px serif';
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#fff';
      ctx.fillText(obj.def.icon, s.x, s.y + 5);
    });
  },

  _drawOrbs(ctx, world) {
    world.orbs.forEach(o => {
      const s = Camera.toScreen(o.x, o.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, o.r, 0, Math.PI * 2);
      ctx.fillStyle   = o.color;
      ctx.shadowColor = o.color;
      ctx.shadowBlur  = 8;
      ctx.fill();
      ctx.shadowBlur  = 0;
    });
  },

  _drawActiveZones(ctx, world) {
    if (!world._activeZones?.length) return;
    world._activeZones.forEach(zone => {
      const s    = Camera.toScreen(zone.x, zone.y);
      const pct  = zone.timer / zone.duration;
      const pulse = Math.sin(Date.now() / 120) * 0.15 + 0.85;

      ctx.beginPath();
      ctx.arc(s.x, s.y, zone.radius * pulse, 0, Math.PI * 2);
      ctx.fillStyle   = zone.color + '18';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(s.x, s.y, zone.radius * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = zone.color;
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.5 + pct * 0.5;
      ctx.shadowColor = zone.color;
      ctx.shadowBlur  = 16;
      ctx.stroke();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;

      if (zone.type === 'fire') {
        ctx.beginPath();
        ctx.arc(s.x, s.y, zone.radius * 0.6 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth   = 1.5;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (zone.type === 'toxic') {
        ctx.beginPath();
        ctx.arc(s.x, s.y, zone.radius * 0.5 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff44';
        ctx.lineWidth   = 1.5;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1;

        for (let i = 0; i < 6; i++) {
          const a  = (i / 6) * Math.PI * 2 + Date.now() / 1200;
          const r  = zone.radius * 0.7 * pulse;
          const px = s.x + Math.cos(a) * r;
          const py = s.y + Math.sin(a) * r;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle   = '#00ff44';
          ctx.globalAlpha = 0.6;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Buz kristalleri (ice'a özel görsel)
      if (zone.type === 'ice') {
        for (let i = 0; i < 8; i++) {
          const a  = (i / 8) * Math.PI * 2 + Date.now() / 2000;
          const r  = zone.radius * 0.75 * pulse;
          const px = s.x + Math.cos(a) * r;
          const py = s.y + Math.sin(a) * r;

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(0, -5);
          ctx.lineTo(2, 3);
          ctx.lineTo(-2, 3);
          ctx.closePath();
          ctx.fillStyle   = '#b3f5ff';
          ctx.globalAlpha = 0.7;
          ctx.shadowColor = '#7fd8f8';
          ctx.shadowBlur  = 8;
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
      }

      // Şimşek çakmaları (lightning'e özel görsel)
      if (zone.type === 'lightning') {
        const boltCount = 4;
        for (let i = 0; i < boltCount; i++) {
          const a   = (i / boltCount) * Math.PI * 2 + Date.now() / 300;
          const len = zone.radius * 0.8 * pulse;
          const ex  = s.x + Math.cos(a) * len;
          const ey  = s.y + Math.sin(a) * len;
          const mx  = (s.x + ex) / 2 + (Math.random() - 0.5) * 20;
          const my  = (s.y + ey) / 2 + (Math.random() - 0.5) * 20;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.quadraticCurveTo(mx, my, ex, ey);
          ctx.strokeStyle = '#ffffaa';
          ctx.lineWidth   = 1.5;
          ctx.globalAlpha = 0.6;
          ctx.shadowColor = '#ffe033';
          ctx.shadowBlur  = 12;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.quadraticCurveTo(mx, my, ex, ey);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth   = 0.5;
          ctx.shadowBlur  = 0;
          ctx.stroke();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }

      // Girdap sarmalı (wind'e özel görsel)
      if (zone.type === 'wind') {
        const spiralCount = 3;
        for (let s2 = 0; s2 < spiralCount; s2++) {
          const baseAngle = (s2 / spiralCount) * Math.PI * 2 + Date.now() / 600;
          ctx.beginPath();
          for (let t = 0; t < 1; t += 0.05) {
            const a  = baseAngle + t * Math.PI * 4;
            const r  = zone.radius * t * pulse;
            const px = s.x + Math.cos(a) * r;
            const py = s.y + Math.sin(a) * r;
            t === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.strokeStyle = zone.color;
          ctx.lineWidth   = 1.5;
          ctx.globalAlpha = 0.45;
          ctx.shadowColor = zone.color;
          ctx.shadowBlur  = 8;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
      }

      const secLeft = Math.ceil(zone.timer / 60);
      ctx.fillStyle    = zone.color;
      ctx.font         = 'bold 13px "Courier New", monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha  = 0.8;
      ctx.fillText(`${secLeft}s`, s.x, s.y);
      ctx.globalAlpha  = 1;
    });
  },

  _drawPowerUpDrops(ctx, world) {
    world.powerUpDrops.forEach(p => {
      if (p.isDead) return;
      const blink = p.life < 120 && Math.floor(p.life / 8) % 2 === 0;
      if (blink) return;

      const s    = Camera.toScreen(p.x, p.y);
      const col  = p.def.color;
      const bob  = Math.sin(p.t * 0.07) * 4;
      const isMagnet = p.typeId === 'magnet';

      ctx.save();

      if (isMagnet) {
        // Dışa doğru genişleyen 3 halka
        for (let i = 0; i < 3; i++) {
          const phase  = (p.t * 0.04 + i * 0.33) % 1;
          const radius = 16 + phase * 36;
          const alpha  = (1 - phase) * 0.55;
          ctx.beginPath();
          ctx.arc(s.x, s.y + bob, radius, 0, Math.PI * 2);
          ctx.strokeStyle = col;
          ctx.lineWidth   = 2;
          ctx.globalAlpha = alpha;
          ctx.shadowColor = col;
          ctx.shadowBlur  = 8;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
      }

      // Arka plan daire
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y + bob, isMagnet ? 16 : 11, 0, Math.PI * 2);
      ctx.fillStyle   = isMagnet ? '#1a001a' : '#0a0a1a';
      ctx.shadowColor = col;
      ctx.shadowBlur  = isMagnet ? 22 : 14;
      ctx.fill();

      // Renkli çerçeve
      ctx.beginPath();
      ctx.arc(s.x, s.y + bob, isMagnet ? 16 : 11, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth   = isMagnet ? 2.5 : 1.5;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // İkon
      ctx.font      = isMagnet ? '18px serif' : '13px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(p.def.icon, s.x, s.y + bob);

      // Mıknatıs: "MAGNET" etiketi
      if (isMagnet) {
        ctx.font      = 'bold 9px "Courier New", monospace';
        ctx.fillStyle = col;
        ctx.textBaseline = 'top';
        ctx.fillText('MAGNET', s.x, s.y + bob + 20);
      }

      ctx.restore();
    });
  },

  // ---- Ice Q burst ----
  _drawIceVFX(ctx) {
    IceVFX.bursts.forEach(b => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, b.alpha);
      if (b.ring) {
        // Expanding freeze ring
        ctx.beginPath();
        ctx.arc(b.x - Camera.x, b.y - Camera.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = b.color ?? '#7fd8f8';
        ctx.lineWidth   = 2.5;
        ctx.shadowColor = '#7fd8f8';
        ctx.shadowBlur  = 10;
        ctx.stroke();
      } else {
        // Ice shard particle
        const sx = b.x - Camera.x + Math.cos(b.a) * b.r;
        const sy = b.y - Camera.y + Math.sin(b.a) * b.r;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 4);
        ctx.lineTo(sx + 2, sy + 3);
        ctx.lineTo(sx - 2, sy + 3);
        ctx.closePath();
        ctx.fillStyle   = '#b3f5ff';
        ctx.shadowColor = '#7fd8f8';
        ctx.shadowBlur  = 8;
        ctx.fill();
      }
      ctx.restore();
    });
  },

  _drawEnemyBullets(ctx, world) {
    world.enemyBullets.forEach(b => {
      if (b.shouldDestroy) return;
      const s = Camera.toScreen(b.x, b.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle   = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur  = 10;
      ctx.fill();
      ctx.shadowBlur  = 0;
    });
  },

  _drawBullets(ctx, world) {
    world.bullets.forEach(b => {
      if (b.shouldDestroy) return;
      const s = Camera.toScreen(b.x, b.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle   = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur  = b.r * 2.5;
      ctx.fill();
      ctx.shadowBlur  = 0;
    });
  },

  _drawEnemies(ctx, world) {
    world.enemies.forEach(e => {
      if (e.isDead) return;
      const s        = Camera.toScreen(e.x, e.y);
      const rotation = e.t * (0.02 - e.sides * 0.002) - Math.PI / 2;

      const shapeDef       = CONFIG.shapes[e.shapeId] ?? {};
      const hints          = shapeDef.renderHints ?? {};
      const isTurretLocked = hints.showTurretLock && e._locked;
      const turretWarning  = isTurretLocked &&
        (e._fireTimer ?? 0) >= (e.behaviorParams?.fireEvery ?? 90) - 10;

      if (e.freezeTimer > 0) {
        ctx.fillStyle   = '#b3f5ff';
        ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 16;
      } else if (e._flashOn) {
        ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 0;
      } else if (turretWarning) {
        ctx.fillStyle   = e.color;
        ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 22;
      } else {
        ctx.fillStyle   = e.color;
        ctx.shadowColor = e.color; ctx.shadowBlur = isTurretLocked ? 14 : 10;
      }

      polygonPath(ctx, s.x, s.y, e.r, e.sides, rotation);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Turret locked outline
      if (isTurretLocked) {
        ctx.strokeStyle = e.color;
        ctx.lineWidth   = 2;
        ctx.globalAlpha = turretWarning ? 0.9 : 0.55;
        polygonPath(ctx, s.x, s.y, e.r + 4, e.sides, rotation);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Shooter ring
      if (hints.showShooterRing || e.extraBehaviorId === 'shooter') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth   = 1;
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(s.x, s.y, e.r + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // HP bar (tougher enemies)
      if (e.maxHp > 20 && e.hp < e.maxHp) {
        const bw = e.r * 2.2, bh = 4;
        const bx = s.x - bw / 2, by = s.y - e.r - 9;
        ctx.fillStyle = '#111';
        ctx.fillRect(bx, by, bw, bh);
        const pct    = Math.max(0, e.hp / e.maxHp);
        const barCol = pct > 0.5 ? '#00ff88' : pct > 0.25 ? '#ffe600' : '#ff3355';
        ctx.fillStyle = barCol;
        ctx.fillRect(bx, by, bw * pct, bh);
      }

      // Pentagon fuse uyarı çemberi
      if (e._fuseActive && e.shapeId === 'pentagon') {
        const explodeR = e.behaviorParams?.explodeR ?? 100;
        const pulse    = Math.sin(Date.now() / 80) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(s.x, s.y, explodeR, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff3355';
        ctx.lineWidth   = 2;
        ctx.globalAlpha = pulse;
        ctx.shadowColor = '#ff3355';
        ctx.shadowBlur  = 12;
        ctx.stroke();
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;

        // İç dolgu — hafif kırmızı alan
        ctx.beginPath();
        ctx.arc(s.x, s.y, explodeR, 0, Math.PI * 2);
        ctx.fillStyle   = 'rgba(255,51,85,0.06)';
        ctx.fill();
      }
    });
  },

  // ---- Lightning chain visual ----
  _drawLightningVFX(ctx) {
    LightningVFX.chains.forEach(c => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, c.alpha);
      // Glow pass
      ctx.strokeStyle = '#ffffaa';
      ctx.lineWidth   = 3;
      ctx.shadowColor = '#ffe033';
      ctx.shadowBlur  = 16;
      // Jitter the line slightly for electric effect
      ctx.beginPath();
      const sx1 = c.x1 - Camera.x, sy1 = c.y1 - Camera.y;
      const sx2 = c.x2 - Camera.x, sy2 = c.y2 - Camera.y;
      const mx  = (sx1 + sx2) / 2 + (Math.random() - 0.5) * 16;
      const my  = (sy1 + sy2) / 2 + (Math.random() - 0.5) * 16;
      ctx.moveTo(sx1, sy1);
      ctx.quadraticCurveTo(mx, my, sx2, sy2);
      ctx.stroke();
      // Inner bright core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1;
      ctx.shadowBlur  = 0;
      ctx.beginPath();
      ctx.moveTo(sx1, sy1); ctx.quadraticCurveTo(mx, my, sx2, sy2); ctx.stroke();
      ctx.restore();
    });
  },

  _drawStoneOrbits(ctx, player) {
    if (!player.orbits?.length) return;
    player.orbits.forEach(orb => {
      if (!orb.alive) return;
      const ox = player.x + Math.cos(orb.angle) * orb.orbitR;
      const oy = player.y + Math.sin(orb.angle) * orb.orbitR;
      const s  = Camera.toScreen(ox, oy);

      ctx.beginPath();
      ctx.arc(s.x + 2, s.y + 2, orb.r, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(0,0,0,0.4)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(s.x, s.y, orb.r, 0, Math.PI * 2);
      ctx.fillStyle   = orb.color ?? '#888888';
      ctx.shadowColor = orb.color ?? '#888888';
      ctx.shadowBlur  = 14;
      ctx.fill();
      ctx.shadowBlur  = 0;

      const pct = orb.timer / orb.duration;
      if (pct < 0.3) {
        ctx.globalAlpha = 0.3 + pct * 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, orb.r, 0, Math.PI * 2);
        ctx.fillStyle = orb.color ?? '#888888';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
  },

  _drawPlayer(ctx, player) {
    const s     = Camera.toScreen(player.x, player.y);
    const flash = player.invulnTimer > 0 && Math.floor(player.invulnTimer / 5) % 2 === 0;
    if (flash) return;

    if (player.damageShieldTimer > 0) {
      ctx.beginPath(); ctx.arc(s.x, s.y, player.r + 9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200,169,110,0.75)'; ctx.lineWidth = 3; ctx.stroke();
    }
    if (player.dashActive > 0) {
      ctx.beginPath(); ctx.arc(s.x, s.y, player.r + 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
    }

    const col = player.elementDef.color;
    const renderDef = player.elementDef?.render ?? {};
    const extraGlow = (player.abilityTimers.q > 0) ? (renderDef.activeQGlow ?? 0) : 0;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(player.angle);
    ctx.fillStyle   = col;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 18 + extraGlow;
    ctx.beginPath();
    ctx.moveTo(player.r + 4, 0);
    ctx.lineTo(-player.r * 0.8, -player.r * 0.85);
    ctx.lineTo(-player.r * 0.4, 0);
    ctx.lineTo(-player.r * 0.8,  player.r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;

    // Element Q rings — config'den okunur
    if (player.abilityTimers.q > 0 && renderDef.activeQRings?.length) {
      const p = player.elementDef.qAbility.params;
      renderDef.activeQRings.forEach(({ radiusKey, color, lineWidth }) => {
        ctx.beginPath(); ctx.arc(s.x, s.y, p[radiusKey], 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth   = lineWidth;
        ctx.stroke();
      });
    }
  },

  // ============================================================
  // HUD
  // ============================================================
  _drawHUD(ctx, player, world) {
    const W  = this.canvas.width, H = this.canvas.height;
    const PAD = 20; // consistent edge padding
    ctx.textBaseline = 'top';

    // ---- Sol üst HUD paneli ----
    const hbW   = 180;
    const hFont = 'bold 15px monospace';
    const hLH   = 22; // line height including gap
    const hpPct = Math.max(0, player.hp / player.maxHp);
    const hpCol = hpPct > 0.5 ? '#00ff88' : hpPct > 0.25 ? '#ffe600' : '#ff3355';
    const killPct = Math.min(1, world.waveEnemyKilled / (world.waveEnemyTotal || 1));
    const killCol = killPct >= 1 ? '#00ff88' : '#ffffff';

    // Panel background
    const panelH = 4 * hLH + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(PAD - 6, PAD - 4, hbW + 12, panelH);

    ctx.font      = hFont;
    ctx.textAlign = 'left';

    // HP
    ctx.fillStyle = hpCol;
    ctx.fillText(`HP: ${Math.ceil(player.hp)} / ${player.maxHp}`, PAD, PAD);

    // LV
    ctx.fillStyle = '#c9a3ff';
    ctx.fillText(`LV ${player.level}`, PAD, PAD + hLH);

    // GOLD
    const goldFlashing = Juice.hudFlash.gold > 0;
    ctx.fillStyle   = goldFlashing ? '#fff9aa' : '#ffe600';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur  = goldFlashing ? 10 : 0;
    ctx.fillText(`GOLD: ${player.gold}`, PAD, PAD + hLH * 2);
    ctx.shadowBlur  = 0;

    // KILL
    ctx.fillStyle = killCol;
    ctx.fillText(`KILL: ${world.waveEnemyKilled}/200`, PAD, PAD + hLH * 3);

    // XP bar
    const expPct  = Math.min(1, player.exp / player.expReq);
    const xpBarW  = hbW;
    const xpBarH  = 6;
    const xpBarX  = PAD;
    const xpBarY  = PAD + 4 * hLH + 2;

    const expFlashing = Juice.hudFlash.exp > 0;
    const xpBarColor  = expFlashing ? '#e0c0ff' : '#c9a3ff';
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);
    ctx.fillStyle   = xpBarColor;
    ctx.shadowColor = '#c9a3ff';
    ctx.shadowBlur  = expFlashing ? 10 : 0;
    ctx.fillRect(xpBarX, xpBarY, xpBarW * expPct, xpBarH);
    ctx.shadowBlur  = 0;

    // XP yüzde yazısı
    ctx.fillStyle    = expFlashing ? '#c9a3ff' : '#7a5aaa';
    ctx.font         = '9px "Courier New", monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`XP: ${player.exp} / ${player.expReq}`, xpBarX, xpBarY + xpBarH + 2);

    // Aim modu göstergesi
    const aimLabels = ['🎯 MOUSE', '🎯 NEAREST', '🎯 STRONGEST'];
    const aimColors = ['#9fb4d6', '#00ff88', '#ff9500'];
    ctx.fillStyle    = aimColors[player.aimMode];
    ctx.font         = 'bold 11px "Courier New", monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(aimLabels[player.aimMode], PAD, xpBarY + xpBarH + 14);

    // ---- Wave + timer (top center) ----
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#ff00d4'; ctx.font = 'bold 26px "Courier New", monospace';
    ctx.shadowColor = '#ff00d4'; ctx.shadowBlur = 8;
    ctx.fillText(`WAVE ${world.wave}${world.isBossWave ? ' — BOSS!' : ''}`, W / 2, PAD);
    ctx.shadowBlur = 0;
    if (!world.isBossWave) {
      const tLeft = Math.ceil(Math.max(0, world.waveTimeLeft));
      ctx.fillStyle = tLeft < 10 ? '#ff3355' : '#9fb4d6';
      ctx.font = '15px "Courier New", monospace';
      ctx.fillText(`${tLeft}s`, W / 2, PAD + 26);
    }

    // ---- Difficulty (top right) ----
    ctx.textAlign  = 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle  = '#ff9500'; ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(`×${world.difficulty.toFixed(2)} DIFFICULTY`, W - PAD, PAD);
    ctx.fillStyle  = '#55668a'; ctx.font = '12px "Courier New", monospace';
    ctx.fillText(`Kills: ${world.kills}`, W - PAD, PAD + 20);

    // ---- Dominant shape + tier warning (3s at wave start) ----
    if ((world._waveWeightShowTimer ?? 0) > 0 && world.waveWeights && world.waveTierWeights) {
      const dominantShape = Object.entries(world.waveWeights).sort((a, b) => b[1] - a[1])[0][0];
      const dominantLabel = (CONFIG.shapes[dominantShape]?.label ?? dominantShape).toUpperCase();
      const dominantTierIdx = world.waveTierWeights.indexOf(Math.max(...world.waveTierWeights));
      const tierDef   = BALANCE.tiers[dominantTierIdx] ?? { label: `T${dominantTierIdx + 1}`, color: '#ff9500' };
      const alpha     = Math.min(1, world._waveWeightShowTimer / 30);
      const tierColor = tierDef.color ?? '#ff9500';
      ctx.save();
      ctx.globalAlpha  = alpha;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = 'bold 22px "Courier New", monospace';
      ctx.fillStyle    = tierColor;
      ctx.shadowColor  = tierColor;
      ctx.shadowBlur   = 20;
      ctx.fillText(
        `⚠ YOĞUN: ${tierDef.label?.toUpperCase() ?? `T${dominantTierIdx + 1}`} + ${dominantLabel}`,
        W / 2, H / 2 - 120
      );
      ctx.restore();
    }

    // ---- Clear bonus banner ----
    if (world.clearBonus) {
      const blink = Math.floor(Date.now() / 400) % 2 === 0;
      if (blink) {
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = 'bold 22px "Courier New", monospace';
        ctx.fillStyle    = '#00ff88';
        ctx.shadowColor  = '#00ff88';
        ctx.shadowBlur   = 20;
        ctx.fillText('✨ CLEAR BONUS', W / 2, H / 2 - 80);
        ctx.restore();
      }
    }

    // ---- Ability slots (bottom center) ----
    this._drawAbilitySlots(ctx, player, W, H, PAD);

    // ---- Active power-ups ----
    this._drawActivePowerups(ctx, player, H, PAD);

    // ---- Minimap ----
    this._drawMinimap(ctx, player, world);

    // ---- F1 debug hint ----
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font         = '8px "Courier New", monospace';
    ctx.fillStyle    = '#333333';
    ctx.fillText('F1: Debug | Space: Aim Modu', PAD, H - PAD);

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  },

  _drawDebugOverlay(ctx, player, world) {
    const PAD  = 20;
    const pW   = 300, pH = 400;
    const px   = PAD;
    const py   = this.canvas.height - pH - PAD - 20; // above F1 hint

    // Panel background
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, pW, pH);
    ctx.strokeRect(px, py, pW, pH);

    const LINE = 14;
    let cy = py + 12;
    const line = (text, color = '#aabbcc', bold = false) => {
      ctx.font      = `${bold ? 'bold ' : ''}11px "Courier New", monospace`;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(text, px + 8, cy);
      cy += LINE;
    };
    const divider = (label, color = '#556677') => {
      cy += 2;
      ctx.fillStyle = color;
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`— ${label} —`, px + 8, cy);
      cy += LINE;
    };

    const fmt = v => (Number.isFinite(v) ? v.toFixed(1) : '?');

    // === DALGA BİLGİSİ ===
    line(`=== WAVE ${world.wave} ===`, '#ff00d4', true);
    line(`Difficulty: ×${fmt(world.difficulty)}  |  Enemies: ${world.waveEnemyKilled}/${world.waveEnemyTotal}`);

    // === ŞEKIL AĞIRLIKLARI ===
    divider('Shape Weights');
    if (world.waveWeights) {
      const shapeTotal = Object.values(world.waveWeights).reduce((s, w) => s + w, 0);
      const parts = Object.entries(world.waveWeights)
        .map(([id, w]) => `${CONFIG.shapes[id]?.labelShort ?? id}: ${shapeTotal ? (w / shapeTotal * 100).toFixed(1) : '?'}%`);
      // two per row
      for (let i = 0; i < parts.length; i += 2) {
        line(`${parts[i].padEnd(18)}${parts[i + 1] ?? ''}`, '#9fb4d6');
      }
    }

    // === TİER AĞIRLIKLARI ===
    divider('Tier Weights');
    if (world.waveTierWeights) {
      const tierTotal = world.waveTierWeights.reduce((s, w) => s + w, 0);
      const parts = world.waveTierWeights
        .map((w, i) => {
          const pct = tierTotal ? (w / tierTotal * 100).toFixed(1) : '?';
          const mul = BALANCE.tiers[i]?.rewardMul ?? '?';
          return `${BALANCE.tiers[i]?.label ?? `T${i+1}`}: ${pct}% (×${mul})`;
        });
      for (let i = 0; i < parts.length; i += 2) {
        line(`${(parts[i] ?? '').padEnd(20)}${parts[i + 1] ?? ''}`, '#9fb4d6');
      }
    }

    // === SON KILLS ===
    divider('Recent Kills');
    if (world._debugLog?.length) {
      world._debugLog.forEach(k => {
        const tierDef   = BALANCE.tiers[k.tier - 1];
        const tierColor = tierDef?.color ?? '#aabbcc';
        const rewardStr = tierDef ? `×${tierDef.rewardMul}` : '×?';
        line(
          `[${CONFIG.shapes[k.shape]?.labelAbbr ?? k.shape.slice(0,3).toUpperCase()}] T${k.tier}(${rewardStr})  HP:${k.hp}  DMG:${k.contactDmg}  G:${k.gold}  EXP:${k.exp}`,
          tierColor
        );
      });
    } else {
      line('(no kills yet)', '#445566');
    }

    // === OYUNCU STATLARI ===
    divider('Player');
    const spd = Number.isFinite(player.speed) ? player.speed.toFixed(1) : '?';
    line(`HP: ${Math.ceil(player.hp)}/${player.maxHp}  |  Damage: ${player.damage}  |  Speed: ${spd}`);
    line(`Crit: ${(player.critChance * 100).toFixed(0)}%/${(player.critDmgPct * 100).toFixed(0)}%  |  Pierce: ${player.pierce}  |  Bullets: ${player.bulletCount}`);
    line(`Gold: ${player.gold}  |  Lifesteal: ${(player.lifeSteal * 100).toFixed(0)}%`);

    ctx.restore();
  },

  _drawMinimap(ctx, player, world) {
    const mW = 160, mH = 120, pad = 20;
    const mx = this.canvas.width  - mW - pad;
    const my = this.canvas.height - mH - pad;
    const sx = mW / CONFIG.world.width;
    const sy = mH / CONFIG.world.height;

    // Background + border
    ctx.fillStyle   = 'rgba(5,3,18,0.75)';
    ctx.fillRect(mx, my, mW, mH);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(mx, my, mW, mH);

    // World boundary
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(mx, my, mW, mH);

    // Orbs
    world.orbs.forEach(o => {
      ctx.beginPath();
      ctx.arc(mx + o.x * sx, my + o.y * sy, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = o.kind === 'gold' ? '#ffcc33' : '#b366ff';
      ctx.fill();
    });

    // Enemies
    world.enemies.forEach(e => {
      if (e.isDead) return;
      const r = e.isBoss ? 4 : 2;
      ctx.beginPath();
      ctx.arc(mx + e.x * sx, my + e.y * sy, r, 0, Math.PI * 2);
      ctx.fillStyle   = e.isBoss ? '#ffe600' : '#ff3355';
      ctx.shadowColor = e.isBoss ? '#ffe600' : 'transparent';
      ctx.shadowBlur  = e.isBoss ? 6 : 0;
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Player dot
    ctx.beginPath();
    ctx.arc(mx + player.x * sx, my + player.y * sy, 3, 0, Math.PI * 2);
    ctx.fillStyle   = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur  = 5;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // Kill counter inside minimap
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font         = 'bold 10px "Courier New", monospace';
    ctx.fillStyle    = world.clearBonus ? '#00ff88' : '#556677';
    ctx.fillText(`${world.waveEnemyKilled}/${world.waveEnemyTotal}`, mx + mW - 4, my + mH - 4);
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  },

  // Called from game.js during WAVE_TRANSITION state (after draw)
  drawWaveTransition(countdown) {
    const ctx = this.ctx;
    const W   = this.canvas.width, H = this.canvas.height;

    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle   = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 24;
    ctx.font        = 'bold 28px "Courier New", monospace';
    ctx.fillText('WAVE CLEAR!', W / 2, H / 2 - 68);

    const numSize = Math.max(60, Math.round(Math.min(W, H) * 0.16));
    ctx.fillStyle   = '#ffe600';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur  = 48;
    ctx.font        = `bold ${numSize}px "Courier New", monospace`;
    ctx.fillText(String(countdown), W / 2, H / 2 + 24);

    ctx.shadowBlur   = 0;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  },

  _drawAbilitySlots(ctx, player, W, H, PAD) {
    const sz     = 60;
    const gap    = 10;
    const total  = 4 * sz + 3 * gap;
    const startX = W / 2 - total / 2;
    const y      = H - sz - PAD - 20;
    const pulse  = Math.sin(Date.now() / 220) * 0.5 + 0.5;

    const slots = [
      { key: 'q',     label: 'Q'  },
      { key: 'e',     label: 'E'  },
      { key: 'r',     label: 'R'  },
      { key: 'shift', label: 'SH' },
    ];

    slots.forEach(({ key, label }, i) => {
      const x       = startX + i * (sz + gap);
      const ability = player.abilitySlots[key];
      const cd      = player.abilityCooldowns[key] ?? 0;
      const maxCd   = ability?.cooldown ?? 1;
      const ready   = cd <= 0;
      const active  = (player.abilityTimers?.[key] ?? 0) > 0;
      const isQ     = key === 'q';
      const elColor = player.elementDef?.color ?? '#00f0ff';
      const locked  = !isQ && !ability;

      ctx.save();

      if (locked) {
        // Kilitli slot
        ctx.fillStyle   = '#0a0818';
        ctx.strokeStyle = '#2a2a3a';
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.roundRect(x, y, sz, sz, 8); ctx.fill(); ctx.stroke();
        ctx.font         = '28px serif';
        ctx.fillStyle    = '#445566';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒', x + sz / 2, y + sz / 2);
      } else {
        // Aktif / dolu slot
        const slotColor = isQ ? elColor : (ability?.color ?? '#00f0ff');

        // Glow
        if (active) {
          ctx.shadowBlur  = 14 + pulse * 16;
          ctx.shadowColor = slotColor;
        } else if (ready) {
          ctx.shadowBlur  = isQ ? 8 + pulse * 12 : 4 + pulse * 8;
          ctx.shadowColor = slotColor;
        }

        ctx.fillStyle   = 'rgba(20,20,45,0.88)';
        ctx.strokeStyle = slotColor;
        ctx.lineWidth   = isQ ? 3 : 2;
        ctx.beginPath(); ctx.roundRect(x, y, sz, sz, 8); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;

        // Active colour wash
        if (active) {
          ctx.save();
          ctx.globalAlpha = 0.10 + pulse * 0.12;
          ctx.fillStyle   = slotColor;
          ctx.beginPath(); ctx.roundRect(x, y, sz, sz, 8); ctx.fill();
          ctx.restore();
        }

        // Cooldown overlay (top → down)
        if (!ready) {
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.62)';
          const fillH = sz * (cd / maxCd);
          ctx.beginPath(); ctx.roundRect(x, y, sz, fillH, 8); ctx.fill();
          ctx.fillStyle    = '#cccccc';
          ctx.font         = 'bold 12px "Courier New", monospace';
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(Math.ceil(cd / 60) + 's', x + sz / 2, y + sz / 2);
          ctx.restore();
        }

        // Icon
        ctx.font         = '36px serif';
        ctx.fillStyle    = '#ffffff';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ability?.icon ?? '?', x + sz / 2, y + sz / 2);
      }

      ctx.restore();

      // Key label below slot
      ctx.fillStyle    = locked ? '#334455' : '#445566';
      ctx.font         = 'bold 11px "Courier New", monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, x + sz / 2, y + sz + 5);
    });
  },

  _drawActivePowerups(ctx, player, H, PAD) {
    const active = [];
    Object.entries(player.powerups ?? {}).forEach(([key, timer]) => {
      if (timer > 0 && CONFIG.powerups[key]) {
        active.push({ ...CONFIG.powerups[key], timer });
      }
    });
    if (!active.length) return;
    ctx.textAlign = 'left';
    active.forEach((p, i) => {
      ctx.fillStyle = p.color;
      ctx.font      = 'bold 13px "Courier New", monospace';
      ctx.fillText(`${p.icon} ${p.name}  ${Math.ceil(p.timer / 60)}s`, PAD, H - PAD - 80 - i * 20);
    });
  },

  get cameraX() { return Camera.x; },
  get cameraY() { return Camera.y; },
};
