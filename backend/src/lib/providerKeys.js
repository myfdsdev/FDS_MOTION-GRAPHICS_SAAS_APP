// Provider API-key store — lets an admin manage keys from the dashboard instead
// of editing .env. Keys are encrypted (secrets.js, AES-256-GCM) and stored in
// AppSetting. Resolution order at call time: DB key (admin panel) → env var.
//
// An in-memory cache keeps getProviderKey() synchronous (the LLM caller builds
// its provider list synchronously). The cache is hydrated at boot via
// loadProviderKeys() and refreshed on every admin save.

import { AppSetting } from "../models.js";
import { encryptSecret, decryptSecret } from "./secrets.js";

const STORE_KEY = "provider_keys";

// The providers the admin panel manages. `env` lists the .env var(s) checked as
// fallback (first match wins). `category` groups them in the UI.
export const PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Claude)", category: "brain", env: ["ANTHROPIC_API_KEY"] },
  { id: "openai", label: "OpenAI", category: "brain", env: ["OPENAI_API_KEY"] },
  { id: "openrouter", label: "OpenRouter", category: "brain", env: ["OPENROUTER_API_KEY"] },
  { id: "gemini", label: "Google Gemini", category: "brain", env: ["GEMINI_API_KEY"] },
  { id: "fal", label: "fal.ai (image/video/music)", category: "media", env: ["FAL_KEY", "FAL_API_KEY"] },
  { id: "runway", label: "Runway (Gen-4 video)", category: "media", env: ["RUNWAY_API_KEY"] },
  { id: "kie", label: "kie.ai (Veo/Suno/Kling)", category: "media", env: ["KIE_API_KEY"] },
  { id: "elevenlabs", label: "ElevenLabs (voice)", category: "voice", env: ["ELEVENLABS_API_KEY"] },
];

const PROVIDER_BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

// id -> decrypted key from the DB (admin-set). Empty until loaded.
const cache = new Map();
let loaded = false;

/** Hydrate the cache from the DB. Call once at boot (and after each save). */
export async function loadProviderKeys() {
  try {
    const row = await AppSetting.findOne({ key: STORE_KEY }).lean();
    cache.clear();
    const enc = row?.value || {};
    for (const { id } of PROVIDERS) {
      if (enc[id]) {
        const val = decryptSecret(enc[id]);
        if (val) cache.set(id, val);
      }
    }
    loaded = true;
  } catch (err) {
    console.warn("[providerKeys] load failed, using env only:", err?.message || err);
  }
}

function envValue(provider) {
  for (const name of provider.env) {
    if (process.env[name]) return process.env[name];
  }
  return "";
}

/** Resolve a provider's key: admin-set DB value first, then env fallback. */
export function getProviderKey(id) {
  if (cache.has(id)) return cache.get(id);
  const provider = PROVIDER_BY_ID.get(id);
  return provider ? envValue(provider) : "";
}

/**
 * Save admin-set keys. `patch` is { id: value }. A non-empty value sets/replaces
 * the key (encrypted); an empty string / null clears it (falls back to env).
 */
export async function setProviderKeys(patch = {}) {
  const row = await AppSetting.findOne({ key: STORE_KEY }).lean();
  const enc = { ...(row?.value || {}) };

  for (const [id, value] of Object.entries(patch)) {
    if (!PROVIDER_BY_ID.has(id)) continue; // ignore unknown providers
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) enc[id] = encryptSecret(trimmed);
    else delete enc[id];
  }

  await AppSetting.updateOne({ key: STORE_KEY }, { $set: { value: enc } }, { upsert: true });
  await loadProviderKeys(); // refresh cache
  return providerKeySummaries();
}

/**
 * Safe summaries for the admin UI — never returns raw keys. Shows whether each
 * provider is configured, where from (db | env), and the last 4 chars.
 */
export function providerKeySummaries() {
  return PROVIDERS.map((p) => {
    const fromDb = cache.has(p.id) && cache.get(p.id);
    const value = fromDb || envValue(p);
    return {
      id: p.id,
      label: p.label,
      category: p.category,
      configured: Boolean(value),
      source: fromDb ? "db" : value ? "env" : null,
      last4: value ? value.slice(-4) : null,
    };
  });
}

export function isLoaded() {
  return loaded;
}
