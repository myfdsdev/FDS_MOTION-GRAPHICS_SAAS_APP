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

export const LOTTIE_ASSETS = [
  {
    id: "business-growth-chart",
    label: "Business growth chart",
    category: "business",
    tags: ["growth", "analytics", "chart", "revenue"],
  },
  {
    id: "saas-dashboard-flow",
    label: "SaaS dashboard flow",
    category: "saas",
    tags: ["dashboard", "workflow", "automation", "product"],
  },
  {
    id: "marketing-megaphone",
    label: "Marketing megaphone",
    category: "marketing",
    tags: ["launch", "announcement", "campaign", "promotion"],
  },
  {
    id: "personal-profile-intro",
    label: "Personal profile intro",
    category: "personal",
    tags: ["profile", "creator", "portfolio", "identity"],
  },
  {
    id: "local-store-offer",
    label: "Local store offer",
    category: "local-business",
    tags: ["store", "offer", "location", "service"],
  },
];

export const LOTTIE_ASSET_IDS = LOTTIE_ASSETS.map((asset) => asset.id);

export function lottieAssetPromptList() {
  return LOTTIE_ASSETS.map(
    (asset) => `${asset.id} (${asset.category}: ${asset.tags.join(", ")})`
  ).join("; ");
}
