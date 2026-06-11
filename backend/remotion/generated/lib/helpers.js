// Cubic ease-in-out
export const ease = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function withDefaults(partial, defaults) {
  const safe = partial && typeof partial === "object" ? partial : {};
  const out = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (safe[key] !== undefined && safe[key] !== null) out[key] = safe[key];
  }
  return out;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export const easings = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeOutBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export function asNumber(val, def = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
}

export function asString(val, def = "") {
  if (val == null) return def;
  return String(val);
}

export function asArray(val, def = []) {
  return Array.isArray(val) ? val : def;
}

// Deterministic PRNG — same output every render for a given seed.
export function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
