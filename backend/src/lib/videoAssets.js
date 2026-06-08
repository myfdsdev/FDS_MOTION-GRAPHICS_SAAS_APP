export const VIDEO_CATEGORIES = [
  "business",
  "personal",
  "saas",
  "marketing",
  "local-business",
];

/** Scene visual backdrop themes. All content is in elements[]. */
export const SCENE_THEMES = [
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
