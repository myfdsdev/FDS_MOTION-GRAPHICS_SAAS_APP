export const VIDEO_CATEGORIES = [
  "business",
  "personal",
  "saas",
  "marketing",
  "local-business",
];

/**
 * High-level video scene components. Each one is a complete, self-contained
 * animated scene that renders the scene's headline + subtext on a distinct
 * animated background. The AI picks one per scene and writes the copy; the
 * component handles the entire visual identity.
 *
 * Twenty options total — broad enough that a 5-scene video can have 5 totally
 * different looks without ever repeating.
 */
export const SCENE_THEMES = [
  // ---- Existing 10 ----
  "gradient-flow",     // Animated gradient blobs with slow drift
  "geometric",         // Angular shapes, grid overlays, bold lines
  "spotlight",         // Dark bg with a focused radial light
  "split-tone",        // Two-color diagonal or vertical split
  "minimal-dark",      // Near-black with subtle grain/grid
  "minimal-light",     // Clean white/cream with soft shadows
  "mesh-gradient",     // Multi-color gradient mesh (modern SaaS feel)
  "particle-field",    // Floating dots/circles with parallax drift
  "aurora",            // Flowing color bands like northern lights
  "bold-color",        // Single saturated bg with contrasting accents
  // ---- New 10 ----
  "kinetic-type",      // Big kinetic word-by-word headline on dark bg
  "neon-grid",         // Synthwave neon perspective grid + glow text
  "paper-craft",       // Layered cut-paper feel with soft shadows
  "glass-card",        // Frosted glass card over a moving gradient
  "ticker-tape",       // Headline crawling across the frame (news ticker)
  "code-terminal",     // Monospaced terminal styling, headline typed in
  "retro-tv",          // CRT scanlines + chroma shift + RGB split
  "data-viz",          // Sparkline / chart-like accent strokes behind text
  "magazine-cover",    // Editorial typography over a soft photo wash
  "starfield",         // Slow-moving stars + headline drifting forward
];


// Starter animations removed — the Lottie library is now populated only by
// admin uploads (see backend/src/lib/lottieLibrary.js).
export const LOTTIE_ASSETS = [];

export const LOTTIE_ASSET_IDS = LOTTIE_ASSETS.map((asset) => asset.id);

export function lottieAssetPromptList() {
  return LOTTIE_ASSETS.map(
    (asset) => `${asset.id} (${asset.category}: ${asset.tags.join(", ")})`
  ).join("; ");
}
