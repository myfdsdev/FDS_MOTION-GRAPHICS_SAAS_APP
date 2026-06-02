export const VIDEO_CATEGORIES = [
  "business",
  "personal",
  "saas",
  "marketing",
  "local-business",
];

export const SCENE_TEMPLATES = [
  "kinetic-title",
  "animated-bg-text",
  "app-showcase",
  "offer-burst",
  "proof-cards",
  "final-cta",
  "karaoke-subtitle",
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
