// Style playbooks — deliberate visual systems the code-gen model follows so
// output reads as a designed brand look, not a generic AI slideshow.
//
// Each playbook is plain data (palette / typography / motion / layout + do &
// don't lists). `renderStyleBlock()` turns one into a compact prompt section
// that the component system prompt injects. The set is intentionally small and
// opinionated; add presets here and they appear automatically in the UI via
// `listPlaybooks()`.
//
// This is original work — it is NOT derived from any AGPL source.

export const PLAYBOOKS = {
  "clean-corporate": {
    id: "clean-corporate",
    name: "Clean Corporate",
    description: "Polished, trustworthy motion graphics for SaaS, finance, and explainers.",
    mood: "calm, credible, premium",
    palette: {
      background: "#0B1220",
      surface: "#121E2C",
      primaryText: "#FFFFFF",
      secondaryText: "#9FB3C8",
      accent: "#22D3EE",
      accentAlt: "#34D399",
      rule: "Dark navy base, ONE cyan/teal accent, white text. Never more than two accent hues.",
    },
    typography: {
      displayFont: "Space Grotesk, Inter, system-ui, sans-serif",
      bodyFont: "Inter, system-ui, sans-serif",
      weights: "700–800 for display, 400–500 for body",
      treatment: "Generous letter-spacing on caps, tight leading on big numbers.",
    },
    motion: {
      language: "Restrained and precise. Soft spring entrances, gentle parallax, no bounce-heavy overshoot.",
      transitions: "Cross-fades and soft wipes between scenes. Never a hard cut.",
      easing: "Easing.out(Easing.cubic) for moves; low-stiffness spring for scale.",
      pacing: "Calm. Let each beat breathe for ~2.5–3.5s.",
    },
    layout: [
      "Strong grid, wide safe margins (≥8% of frame).",
      "Lead with stat cards, KPI grids, and charts from the component library.",
      "One clear focal element per scene; supporting text is small and quiet.",
    ],
    do: [
      "Use BarChart / LineChart / KPIGrid for any data.",
      "Lower-third labels and section titles for structure.",
      "Subtle background motion (slow gradient drift, thin animated rules).",
    ],
    dont: [
      "No rainbow palettes, no neon-on-neon.",
      "No confetti, no cartoon bounce, no meme energy.",
      "No more than 2 type weights on screen at once.",
    ],
  },

  "bold-flat": {
    id: "bold-flat",
    name: "Bold Flat",
    description: "Energetic, oversized flat-color motion for social, startups, and promos.",
    mood: "loud, punchy, confident",
    palette: {
      background: "#0A0A0F",
      surface: "#161616",
      primaryText: "#FFFFFF",
      secondaryText: "#111111",
      accent: "#D6F54A",
      accentAlt: "#FF4D8D",
      rule: "Black base with full-bleed flat color bands. Lime + hot-pink accents. High saturation, hard edges.",
    },
    typography: {
      displayFont: "Inter, system-ui, sans-serif",
      bodyFont: "Inter, system-ui, sans-serif",
      weights: "800–900 only for display — giant and cropped",
      treatment: "Oversized words cropped by the frame edges; uppercase or aggressive lowercase.",
    },
    motion: {
      language: "Snap and slam. Bands slide/snap into place, letters squeeze and stretch, quick stagger.",
      transitions: "Hard snaps and color-band wipes, with just a few frames of overlap.",
      easing: "Stiff spring (stiffness ~150, low damping) for punch; short clamps.",
      pacing: "Fast. 1.2–2s per beat, kinetic throughout.",
    },
    layout: [
      "Full-width horizontal color bands with huge black/white labels.",
      "Type cropped off-canvas; arrows, stripes, and stacked color blocks.",
      "Asymmetric, edge-to-edge — minimal margins.",
    ],
    do: [
      "Giant cropped words as the main visual.",
      "Yellow/lime arrows and connectors between elements.",
      "Bands that reorder, slide, and snap across the frame.",
    ],
    dont: [
      "No soft pastel gradients, no gentle fades as the primary transition.",
      "No tiny centered text — go big or cut it.",
      "No generic floating particles unless they support the type.",
    ],
  },

  "minimal-mono": {
    id: "minimal-mono",
    name: "Minimal Mono",
    description: "Quiet, editorial minimalism with precise cascading typography.",
    mood: "refined, spacious, intentional",
    palette: {
      background: "#F4F1EA",
      surface: "#FFFFFF",
      primaryText: "#1A1A1A",
      secondaryText: "#6B6B6B",
      accent: "#1A1A1A",
      accentAlt: "#8FB7A6",
      rule: "Off-white / mint field, near-black text, at most one muted accent. Mostly monochrome.",
    },
    typography: {
      displayFont: "Georgia, 'Times New Roman', serif",
      bodyFont: "Inter, system-ui, sans-serif",
      weights: "400–500 serif display, small sizes",
      treatment: "Small centered serif, uppercase tracking, letters/lines cascade in on precise timing.",
    },
    motion: {
      language: "Delicate and exact. Letters and rules cascade in one at a time; nothing slams.",
      transitions: "Slow dissolves and masked line-reveals.",
      easing: "Easing.inOut(Easing.cubic); long, smooth durations.",
      pacing: "Slow and deliberate. 3–4s per beat, lots of negative space.",
    },
    layout: [
      "Vast negative space; content sits in the centre or on a single axis.",
      "Thin rules, small caps, generous margins (≥12%).",
      "One idea per scene, never crowded.",
    ],
    do: [
      "Per-character / per-line staggered reveals.",
      "Thin animated underlines and hairline dividers.",
      "Restraint — fewer elements, more space.",
    ],
    dont: [
      "No bold neon, no heavy drop shadows.",
      "No fast cuts or kinetic slamming.",
      "No dense data dashboards — keep it editorial.",
    ],
  },
};

export const DEFAULT_STYLE = "clean-corporate";

/** Lightweight list for populating a UI preset picker. */
export function listPlaybooks() {
  return Object.values(PLAYBOOKS).map(({ id, name, description, mood }) => ({
    id,
    name,
    description,
    mood,
  }));
}

/** Resolve a playbook by id (or pass a playbook object through). Null if unknown. */
export function getPlaybook(idOrPlaybook) {
  if (!idOrPlaybook) return null;
  if (typeof idOrPlaybook === "object") return idOrPlaybook;
  return PLAYBOOKS[idOrPlaybook] || null;
}

/**
 * Render a playbook into a compact prompt section. Returns "" when no/unknown
 * style is given so the base prompt is unchanged (backward compatible).
 */
export function renderStyleBlock(idOrPlaybook) {
  const p = getPlaybook(idOrPlaybook);
  if (!p) return "";

  const palette = Object.entries(p.palette)
    .filter(([k]) => k !== "rule")
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join("\n");

  return `# Active style playbook: ${p.name} (${p.mood})
You MUST design this video in the "${p.name}" visual system. ${p.description}
Treat the rules below as binding constraints — they override the generic
"choose a palette" guidance above.

Palette (use these exact hex values as the core system):
${palette}
  - rule: ${p.palette.rule}

Typography:
  - display: ${p.typography.displayFont} (${p.typography.weights})
  - body: ${p.typography.bodyFont}
  - treatment: ${p.typography.treatment}

Motion language: ${p.motion.language}
  - transitions: ${p.motion.transitions}
  - easing: ${p.motion.easing}
  - pacing: ${p.motion.pacing}

Layout principles:
${p.layout.map((l) => `  - ${l}`).join("\n")}

DO: ${p.do.join(" / ")}
DON'T: ${p.dont.join(" / ")}`.trim();
}
