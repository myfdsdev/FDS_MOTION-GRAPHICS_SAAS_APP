// theme.ts — the per-video design contract.
//
// The scene planner emits ONE `theme` per video ({ bg, fg, accent, accent2 }).
// The renderer resolves it against each scene's ACTUAL backdrop (flat color vs
// scrimmed footage) into a SceneTheme whose text colors are GUARANTEED readable
// — so a bad palette pick by the LLM can never produce invisible text again.
// Components consume SceneTheme instead of hardcoding colors.

export interface Theme {
  /** base background color for color scenes */
  bg: string;
  /** primary text color */
  fg: string;
  /** brand accent (gradients start here) */
  accent: string;
  /** secondary accent (gradients end here) */
  accent2: string;
}

export const DEFAULT_THEME: Theme = {
  bg: "#0B0D17",
  fg: "#F8FAFC",
  accent: "#22D3EE",
  accent2: "#A78BFA",
};

/** Theme resolved against one scene's actual backdrop. */
export interface SceneTheme extends Theme {
  /** secondary/soft text */
  muted: string;
  /** glass panel fill (rgba) that reads on this backdrop */
  panel: string;
  panelBorder: string;
  /** true when the backdrop is light (text must be dark) */
  onLight: boolean;
  /** text-shadow suited to the backdrop */
  shadow: string;
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v.trim());
}

function expand(hex: string): string {
  const h = hex.trim().slice(1);
  return h.length === 3
    ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
    : `#${h}`;
}

export function parseHex(hex: string): [number, number, number] {
  const h = expand(isHex(hex) ? hex : "#000000").slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Perceived luminance 0..1 (fast approximation, only used for thresholds). */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function isLight(hex: string): boolean {
  return luminance(hex) > 0.55;
}

/** Blend a toward b by t (0..1). */
export function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Sanitize a planner-emitted theme; anything invalid falls back to defaults. */
export function normalizeTheme(raw: unknown): Theme {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    bg: isHex(t.bg) ? expand(t.bg as string) : DEFAULT_THEME.bg,
    fg: isHex(t.fg) ? expand(t.fg as string) : DEFAULT_THEME.fg,
    accent: isHex(t.accent) ? expand(t.accent as string) : DEFAULT_THEME.accent,
    accent2: isHex(t.accent2) ? expand(t.accent2 as string) : DEFAULT_THEME.accent2,
  };
}

/** Nudge an accent until it reads against the backdrop. */
function readableAccent(accent: string, onLight: boolean): string {
  let c = accent;
  for (let i = 0; i < 4 && (onLight ? luminance(c) > 0.62 : luminance(c) < 0.28); i++) {
    c = mixHex(c, onLight ? "#000000" : "#FFFFFF", 0.22);
  }
  return c;
}

export interface Backdrop {
  /** "color" = flat fill; "footage" = video/image under a scrim (reads dark) */
  kind: "color" | "footage";
  /** the flat color when kind === "color" */
  color?: string;
}

/**
 * Resolve the video theme against one scene's actual backdrop. This is the
 * contrast guarantee: fg/muted/accent are always readable on what's really
 * behind them, regardless of what the planner picked.
 */
export function resolveSceneTheme(theme: Theme, backdrop: Backdrop): SceneTheme {
  // Scrimmed footage always reads as a dark backdrop.
  const base = backdrop.kind === "footage" ? "#101018" : backdrop.color ?? theme.bg;
  const onLight = backdrop.kind === "color" && isLight(base);

  // Use the theme's fg when it has enough contrast; otherwise force one.
  let fg = theme.fg;
  const fgOk = onLight ? luminance(fg) < 0.4 : luminance(fg) > 0.6;
  if (!fgOk) fg = onLight ? mixHex(base, "#000000", 0.88) : "#F8FAFC";

  const accent = readableAccent(theme.accent, onLight);
  const accent2 = readableAccent(theme.accent2, onLight);

  return {
    bg: base,
    fg,
    accent,
    accent2,
    muted: withAlpha(fg, 0.7),
    panel: onLight ? "rgba(255,255,255,0.62)" : "rgba(8,10,20,0.5)",
    panelBorder: withAlpha(fg, 0.14),
    onLight,
    shadow: onLight ? "0 2px 18px rgba(0,0,0,0.08)" : "0 2px 18px rgba(0,0,0,0.45)",
  };
}

export const DEFAULT_SCENE_THEME: SceneTheme = resolveSceneTheme(DEFAULT_THEME, {
  kind: "footage",
});
