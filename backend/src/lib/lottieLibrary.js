import { LottieAsset } from "../models.js";
import { LOTTIE_ASSETS, LOTTIE_ASSET_IDS } from "./videoAssets.js";

const STARTER_SOURCE = "starter";
const UPLOADED_SOURCE = "uploaded";

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");

  if (slug.length >= 3) return slug;
  return `custom-${slug || "animation"}`.slice(0, 64).replace(/-+$/g, "");
}

function normalizeTags(tags = []) {
  return [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))]
    .slice(0, 10)
    .map((tag) => tag.slice(0, 32));
}

function starterSummary(asset) {
  return {
    id: asset.id,
    label: asset.label,
    category: asset.category,
    tags: asset.tags,
    source: STARTER_SOURCE,
    createdAt: null,
  };
}

function uploadedSummary(asset) {
  return {
    id: asset.assetId,
    label: asset.label,
    category: asset.category,
    tags: asset.tags || [],
    source: UPLOADED_SOURCE,
    createdAt: asset.createdAt?.toISOString?.() || null,
  };
}

function validateLottieAnimationData(animationData) {
  if (!animationData || typeof animationData !== "object" || Array.isArray(animationData)) {
    throw new Error("Lottie animation must be a JSON object");
  }

  const requiredNumbers = ["fr", "op", "w", "h"];
  const missingNumber = requiredNumbers.find((key) => !Number.isFinite(animationData[key]));
  if (missingNumber) {
    throw new Error(`Lottie animation is missing numeric "${missingNumber}"`);
  }

  if (!Array.isArray(animationData.layers)) {
    throw new Error('Lottie animation is missing a "layers" array');
  }
}

async function nextAvailableAssetId(base) {
  let candidate = slugify(base);
  let attempt = 2;

  for (;;) {
    const reserved = LOTTIE_ASSET_IDS.includes(candidate);
    const existing = reserved ? null : await LottieAsset.exists({ assetId: candidate });
    if (!reserved && !existing) return candidate;

    const suffix = `-${attempt}`;
    candidate = `${slugify(base).slice(0, 64 - suffix.length).replace(/-+$/g, "")}${suffix}`;
    attempt += 1;
  }
}

export async function listLottieAssetSummaries() {
  const uploaded = await LottieAsset.find().sort({ createdAt: -1 }).lean();
  return [...uploaded.map(uploadedSummary), ...LOTTIE_ASSETS.map(starterSummary)];
}

export function lottieAssetPromptListFromSummaries(assets) {
  return assets
    .map((asset) => `${asset.id} (${asset.category}: ${asset.tags.join(", ")})`)
    .join("; ");
}

export async function createLottieAsset(input) {
  validateLottieAnimationData(input.animationData);

  const baseId = input.id || `custom-${input.label}`;
  const assetId = await nextAvailableAssetId(baseId);
  const asset = await LottieAsset.create({
    assetId,
    label: input.label.trim(),
    category: input.category,
    tags: normalizeTags(input.tags),
    animationData: input.animationData,
  });

  return uploadedSummary(asset);
}

export function assertKnownLottieAssets(plan, allowedIds) {
  const allowed = new Set(allowedIds);
  const unknown = [
    ...new Set(
      (plan?.scenes || [])
        .map((scene) => scene?.lottieAsset)
        .filter((assetId) => assetId && !allowed.has(assetId))
    ),
  ];

  if (unknown.length) {
    throw new Error(`Unknown Lottie asset selected: ${unknown.join(", ")}`);
  }
}

export async function attachLottieAssetsToPlan(plan) {
  if (!plan || !Array.isArray(plan.scenes)) return plan;

  const uploadedIds = [
    ...new Set(
      plan.scenes
        .map((scene) => scene?.lottieAsset)
        .filter((assetId) => assetId && !LOTTIE_ASSET_IDS.includes(assetId))
    ),
  ];

  if (!uploadedIds.length) return plan;

  const uploaded = await LottieAsset.find({ assetId: { $in: uploadedIds } }).lean();
  const byId = new Map(uploaded.map((asset) => [asset.assetId, asset.animationData]));
  const missing = uploadedIds.filter((assetId) => !byId.has(assetId));
  if (missing.length) {
    throw new Error(`Uploaded Lottie asset not found: ${missing.join(", ")}`);
  }

  return {
    ...plan,
    scenes: plan.scenes.map((scene) => {
      const animationData = byId.get(scene?.lottieAsset);
      return animationData ? { ...scene, lottieAnimationData: animationData } : scene;
    }),
  };
}
