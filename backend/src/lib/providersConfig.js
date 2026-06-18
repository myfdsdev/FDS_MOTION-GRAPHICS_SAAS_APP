// Providers config store — per-model enable/disable flags set from the admin
// Providers manager (category-tabbed UI). Plain JSON in AppSetting
// "providers_config": { enabledModels: { "<provider>:<model>": boolean } }.
// A missing entry means ENABLED (opt-out model). Cache hydrated at boot.

import { AppSetting } from "../models.js";

const STORE_KEY = "providers_config";

let cache = { enabledModels: {} };
let loaded = false;

export async function loadProvidersConfig() {
  try {
    const row = await AppSetting.findOne({ key: STORE_KEY }).lean();
    cache = { enabledModels: {}, ...(row?.value || {}) };
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

/** Merge a patch into the stored config. Body shape: { enabledModels: {...} }. */
export async function setProvidersConfig(patch = {}) {
  const row = await AppSetting.findOne({ key: STORE_KEY }).lean();
  const cur = row?.value || {};
  const next = {
    ...cur,
    ...patch,
    enabledModels: { ...(cur.enabledModels || {}), ...(patch.enabledModels || {}) },
  };
  await AppSetting.updateOne({ key: STORE_KEY }, { $set: { value: next } }, { upsert: true });
  await loadProvidersConfig();
  return getProvidersConfig();
}

export function isLoaded() {
  return loaded;
}
