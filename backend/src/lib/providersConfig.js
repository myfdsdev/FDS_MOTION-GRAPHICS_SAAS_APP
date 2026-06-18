// Providers config store — set from the admin Providers manager. Plain JSON in
// AppSetting "providers_config":
//   { enabledModels: { "<provider>:<model>": boolean },
//     customModels:  { "<provider>:<category>": "<model name>" } }
// enabledModels: missing entry means ENABLED. customModels: a free-text model
// the admin typed for a provider in a category (e.g. kie image → nano-banana-pro).
// Cache hydrated at boot.

import { AppSetting } from "../models.js";

const STORE_KEY = "providers_config";

// capability → category, so getCustomModel can be looked up by either.
const CAP_CATEGORY = {
  text_to_image: "image",
  image_to_video: "video",
  text_to_video: "video",
  video_to_video: "video",
  reference_to_video: "video",
  text_to_speech: "voice",
  music: "music",
};

let cache = { enabledModels: {}, customModels: {} };
let loaded = false;

export async function loadProvidersConfig() {
  try {
    const row = await AppSetting.findOne({ key: STORE_KEY }).lean();
    cache = { enabledModels: {}, customModels: {}, ...(row?.value || {}) };
    loaded = true;
  } catch (err) {
    console.warn("[providersConfig] load failed:", err?.message || err);
  }
}

export function getProvidersConfig() {
  return cache;
}

/** A model is enabled unless explicitly turned off. */
export function isModelEnabled(provider, model) {
  const v = cache.enabledModels?.[`${provider}:${model}`];
  return v === undefined ? true : Boolean(v);
}

/** Admin-typed model for a provider in a capability's category ("" if none). */
export function getCustomModel(provider, capability) {
  const cat = CAP_CATEGORY[capability] || capability;
  return cache.customModels?.[`${provider}:${cat}`] || "";
}

/** Merge a patch into the stored config. Body: { enabledModels?, customModels? }. */
export async function setProvidersConfig(patch = {}) {
  const row = await AppSetting.findOne({ key: STORE_KEY }).lean();
  const cur = row?.value || {};
  const next = {
    ...cur,
    enabledModels: { ...(cur.enabledModels || {}), ...(patch.enabledModels || {}) },
    customModels: { ...(cur.customModels || {}), ...(patch.customModels || {}) },
  };
  // Drop empty custom-model entries so they fall back to defaults.
  for (const [k, v] of Object.entries(next.customModels)) {
    if (!v || !String(v).trim()) delete next.customModels[k];
  }
  await AppSetting.updateOne({ key: STORE_KEY }, { $set: { value: next } }, { upsert: true });
  await loadProvidersConfig();
  return getProvidersConfig();
}

export function isLoaded() {
  return loaded;
}
