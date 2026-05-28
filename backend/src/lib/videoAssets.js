export const VIDEO_CATEGORIES = [
  "business",
  "personal",
  "saas",
  "marketing",
  "local-business",
];

export const SCENE_TEMPLATES = [
  "hero-title",
  "split-lottie-text",
  "dashboard-metrics",
  "feature-cards",
  "cta-end-screen",
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
