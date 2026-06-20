// ============================================================
// JUICE — visual effects layer. Owns particles, damage numbers
// and screen shake. Knows nothing about game logic.
// ============================================================

import { rand } from './utils.js';

class Particle {
  constructor(x, y, color) {
    this.x     = x;
    this.y     = y;
    this.color = color;
    this.r     = rand(1.5, 3.5);
    const spd  = rand(1.5, 5.0);
    const a    = rand(0, Math.PI * 2);
    this.vx    = Math.cos(a) * spd;
    this.vy    = Math.sin(a) * spd;
    this.alpha = 1.0;
    this.decay = rand(0.025, 0.055);
  }
  update() {
    this.x    += this.vx;  this.y    += this.vy;
    this.vx   *= 0.93;     this.vy   *= 0.93;
    this.alpha -= this.decay;
    return this.alpha <= 0;
  }
}

class PickupText {
  constructor(x, y, text, color) {
    this.x     = x;
    this.y     = y;
    this.text  = text;
    this.color = color;
    this.vy    = -0.7;
    this.alpha = 1.0;
    this.life  = 75;
  }
  update() {
    this.y    += this.vy;
    this.life--;
    this.alpha = Math.min(1, this.life / 18);
    return this.life <= 0;
  }
}

class DmgNumber {
  constructor(x, y, text, isCrit, color) {
    this.x     = x + rand(-12, 12);
    this.y     = y;
    this.text  = text;
    this.isCrit= isCrit;
    this.color = color;
    this.vx    = rand(-0.6, 0.6);
    this.vy    = rand(-1.4, -0.6);
    this.alpha = 1.0;
    this.scale = isCrit ? 1.5 : 1.0;
  }
  update() {
    this.x    += this.vx;
    this.y    += this.vy;
    this.alpha -= 0.018;
    return this.alpha <= 0;
  }
}

export const Juice = {
  particles:    [],
  dmgNumbers:   [],
  pickupTexts:  [],
  hudFlash:     { exp: 0, gold: 0 },
  _shake:       0,
  _shakeDk:     0,

  reset() {
    this.particles   = [];
    this.dmgNumbers  = [];
    this.pickupTexts = [];
    this.hudFlash    = { exp: 0, gold: 0 };
    this._shake      = 0;
  },

  addPickupText(x, y, text, color) {
    this.pickupTexts.push(new PickupText(x, y, text, color));
  },

  addExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
  },

  addDmgNumber(x, y, amount, isCrit, color = '#ffffff') {
    this.dmgNumbers.push(new DmgNumber(x, y,
      isCrit ? `💥${amount}` : String(amount), isCrit, color));
  },

  shake(intensity) {
    this._shake   = Math.max(this._shake, intensity);
    this._shakeDk = intensity / (0.3 * 60); // decay over ~0.3s
  },

  update() {
    if (this._shake > 0) { this._shake -= this._shakeDk; if (this._shake < 0) this._shake = 0; }
    if (this.hudFlash.exp  > 0) this.hudFlash.exp--;
    if (this.hudFlash.gold > 0) this.hudFlash.gold--;
    this.particles   = this.particles.filter(p  => !p.update());
    this.dmgNumbers  = this.dmgNumbers.filter(d  => !d.update());
    this.pickupTexts = this.pickupTexts.filter(t => !t.update());
  },

  // Returns {dx, dy} to offset camera for shake
  getShakeOffset() {
    if (this._shake <= 0) return { dx: 0, dy: 0 };
    return { dx: rand(-this._shake, this._shake), dy: rand(-this._shake, this._shake) };
  },

  drawParticles(ctx, camX, camY) {
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y - camY, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  },

  drawDmgNumbers(ctx, camX, camY) {
    this.dmgNumbers.forEach(d => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.alpha);
      ctx.fillStyle   = d.color;
      ctx.font        = `bold ${d.isCrit ? 16 : 11}px monospace`;
      ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
      ctx.fillText(d.text, d.x - camX, d.y - camY);
      ctx.restore();
    });
  },

  drawPickupTexts(ctx, camX, camY) {
    this.pickupTexts.forEach(t => {
      ctx.save();
      ctx.globalAlpha  = Math.max(0, t.alpha);
      ctx.fillStyle    = t.color;
      ctx.font         = 'bold 12px "Courier New", monospace';
      ctx.textAlign    = 'center';
      ctx.shadowColor  = t.color;
      ctx.shadowBlur   = 6;
      ctx.fillText(t.text, t.x - camX, t.y - camY);
      ctx.restore();
    });
  },
};
