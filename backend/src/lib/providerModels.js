// Provider model store — lets an admin set which MODEL each provider/capability
// uses, from the dashboard instead of editing .env. Models aren't secret, so
// they're stored in plain text (AppSetting "provider_models"). Resolution at
// call time: admin value (DB) → env var → built-in default.
//
// Each setting's `id` IS the env var the code already reads (e.g.
// FAL_MODEL_TEXT_TO_IMAGE), so getModel(id, default) is a drop-in for the old
// `process.env[id] || default`. Cache hydrated at boot, refreshed on save.

import { AppSetting } from "../models.js";

const STORE_KEY = "provider_models";

// Manageable model slots. `group` drives UI sectioning; `default` is the
// built-in fallback shown as the placeholder.
export const MODEL_SETTINGS = [
  { id: "ANTHROPIC_MODEL", label: "Anthropic · LLM", provider: "anthropic", group: "brain", default: "claude-sonnet-4-6" },
  { id: "OPENAI_MODEL", label: "OpenAI · LLM", provider: "openai", group: "brain", default: "gpt-4o" },
  { id: "OPENROUTER_MODEL", label: "OpenRouter · LLM", provider: "openrouter", group: "brain", default: "anthropic/claude-3.5-sonnet" },
  { id: "GEMINI_MODEL", label: "Gemini · LLM", provider: "gemini", group: "brain", default: "gemini-2.0-flash" },
  { id: "FAL_MODEL_TEXT_TO_IMAGE", label: "fal · Text → Image", provider: "fal", group: "media", default: "fal-ai/flux/dev" },
  { id: "FAL_MODEL_IMAGE_TO_VIDEO", label: "fal · Image → Video", provider: "fal", group: "media", default: "fal-ai/kling-video/v1/standard/image-to-video" },
  { id: "FAL_MODEL_TEXT_TO_VIDEO", label: "fal · Text → Video", provider: "fal", group: "media", default: "fal-ai/kling-video/v1/standard/text-to-video" },
  { id: "FAL_MODEL_MUSIC", label: "fal · Music", provider: "fal", group: "media", default: "fal-ai/elevenlabs/music" },
  { id: "RUNWAY_VIDEO_MODEL", label: "Runway · Video", provider: "runway", group: "media", default: "gen4_turbo" },
  { id: "RUNWAY_IMAGE_MODEL", label: "Runway · Image", provider: "runway", group: "media", default: "gen4_image" },
];

const BY_ID = new Map(MODEL_SETTINGS.map((m) => [m.id, m]));
const cache = new Map();
let loaded = false;

/** Hydrate the cache from the DB. Call at boot (and after each save). */
export async function loadProviderModels() {
  try {
    const row = await AppSetting.findOne({ key: STORE_KEY }).lean();
    cache.clear();
    const v = row?.value || {};
    for (const m of MODEL_SETTINGS) {
      if (v[m.id]) cache.set(m.id, v[m.id]);
    }
    loaded = true;
  } catch (err) {
    console.warn("[providerModels] load failed, using env/defaults:", err?.message || err);
  }
}

/** Resolve a model: admin (DB) → env → built-in default. Drop-in for env reads. */
export function getModel(id, fallbackDefault) {
  if (cache.has(id)) return cache.get(id);
  if (process.env[id]) return process.env[id];
  if (fallbackDefault != null) return fallbackDefault;
  return BY_ID.get(id)?.default ?? "";
}

/** Save admin model overrides. `patch` is { id: value }. Empty clears (→ env/default). */
export async function setProviderModels(patch = {}) {
  const row = await AppSetting.findOne({ key: STORE_KEY }).lean();
  const v = { ...(row?.value || {}) };
  for (const [id, value] of Object.entries(patch)) {
    if (!BY_ID.has(id)) continue;
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) v[id] = trimmed;
    else delete v[id];
  }
  await AppSetting.updateOne({ key: STORE_KEY }, { $set: { value: v } }, { upsert: true });
  await loadProviderModels();
  return providerModelSummaries();
}

/** Current effective model per setting, with where it came from. */
export function providerModelSummaries() {
  return MODEL_SETTINGS.map((m) => {
    const fromDb = cache.has(m.id);
    const envv = process.env[m.id];
    return {
      id: m.id,
      label: m.label,
      provider: m.provider,
      group: m.group,
      value: fromDb ? cache.get(m.id) : envv || m.default,
      source: fromDb ? "db" : envv ? "env" : "default",
      default: m.default,
    };
  });
}

export function isLoaded() {
  return loaded;
}
