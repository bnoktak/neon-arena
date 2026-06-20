// ============================================================
// AUDIO — Web Audio API, fully synthesized, no files needed.
// AudioContext is created on first user interaction (autoplay policy).
// ============================================================

export const Audio = {
  _ctx: null,

  init() {
    const unlock = () => {
      if (this._ctx) return;
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      window.removeEventListener('mousedown', unlock);
      window.removeEventListener('keydown',   unlock);
    };
    window.addEventListener('mousedown', unlock);
    window.addEventListener('keydown',   unlock);
  },

  play(name) {
    if (!this._ctx) return;
    if (this._ctx.state === 'suspended') this._ctx.resume();
    const fn = _sounds[name];
    if (fn) fn(this._ctx);
  },
};

// ---- Synthesized sound library ----

const _sounds = {

  shoot(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(700, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc.start(); osc.stop(ctx.currentTime + 0.07);
  },

  hit(ctx) {
    const len  = Math.floor(ctx.sampleRate * 0.06);
    const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    src.start();
  },

  kill(ctx) {
    const len  = Math.floor(ctx.sampleRate * 0.2);
    const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src  = ctx.createBufferSource();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filt.type = 'lowpass'; filt.frequency.value = 500;
    src.buffer = buf;
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    src.start();
  },

  levelup(ctx) {
    [261, 329, 392, 523, 659].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t    = ctx.currentTime + i * 0.09;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.start(t); osc.stop(t + 0.14);
    });
  },

  buy(ctx) {
    [523, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t    = ctx.currentTime + i * 0.07;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.12);
    });
  },

  waveStart(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(); osc.stop(ctx.currentTime + 0.35);
  },

  hurt(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(); osc.stop(ctx.currentTime + 0.18);
  },
};
