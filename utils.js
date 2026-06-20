// ============================================================
// UTILS — pure functions, no state, no imports
// ============================================================

export const rand     = (a, b) => a + Math.random() * (b - a);
export const randInt  = (a, b) => Math.floor(rand(a, b + 1));
export const clamp    = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist2    = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx*dx + dy*dy; };
export const dist     = (a, b) => Math.sqrt(dist2(a, b));
export const angle    = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export const lerp     = (a, b, t) => a + (b - a) * t;
export const lerpAngle = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI)  d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// Weighted random: picks a key from { key: weight } map
export function weightedRandom(map) {
  const total = Object.values(map).reduce((s, w) => s + w, 0);
  let r = rand(0, total);
  for (const [key, w] of Object.entries(map)) {
    r -= w;
    if (r <= 0) return key;
  }
  return Object.keys(map)[0];
}

// Polygon path helper for canvas
export function polygonPath(ctx, cx, cy, r, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Spawn position just outside a rectangle
export function edgeSpawn(worldW, worldH, margin = 50) {
  const side = randInt(0, 3);
  if (side === 0) return { x: rand(0, worldW), y: -margin };
  if (side === 1) return { x: worldW + margin, y: rand(0, worldH) };
  if (side === 2) return { x: rand(0, worldW), y: worldH + margin };
  return { x: -margin, y: rand(0, worldH) };
}

// Spawn position at a distance from a point
export function spawnAroundPoint(px, py, minD, maxD, worldW, worldH) {
  const a = rand(0, Math.PI * 2);
  const d = rand(minD, maxD);
  return {
    x: clamp(px + Math.cos(a) * d, 50, worldW - 50),
    y: clamp(py + Math.sin(a) * d, 50, worldH - 50),
  };
}

// Simple modifier object: base + flat bonuses + multipliers
export const Modifier = {
  create: (base) => ({ base, flats: [], muls: [] }),
  eval:   (m) => {
    let v = m.base;
    m.flats.forEach(f => v += f);
    m.muls.forEach(x => v *= x);
    return v;
  },
  addFlat: (m, v) => { m.flats.push(v); return m; },
  addMul:  (m, v) => { m.muls.push(v); return m; },
};

// XP curve
export const xpForLevel = (lvl, base, factor) => Math.round(base * Math.pow(lvl, factor));

// Screen-space circle intersection check
export const circlesOverlap = (ax, ay, ar, bx, by, br) => {
  const dx = bx - ax, dy = by - ay, rr = ar + br;
  return dx*dx + dy*dy <= rr*rr;
};

// Escape HTML (for DOM rendering)
export const esc = (s) => String(s).replace(/[<>&]/g, c =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
