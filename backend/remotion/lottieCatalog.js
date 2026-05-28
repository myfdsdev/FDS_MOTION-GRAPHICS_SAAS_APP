// Starter Lottie animations have been removed. The library is now populated
// only by admin uploads, whose animation JSON is attached to each scene as
// `scene.lottieAnimationData` before rendering (see attachLottieAssetsToPlan).
export const lottieCatalog = [];

// Returns the bundled starter animation for an id, or null. With starters
// removed this is always null — callers must fall back to scene.lottieAnimationData.
export function getLottieAsset(id) {
  return lottieCatalog.find((asset) => asset.id === id) || null;
}
