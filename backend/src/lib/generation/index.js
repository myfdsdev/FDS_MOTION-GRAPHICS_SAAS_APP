// Generation engine — the "hands" of the video platform. ONE entry point
// (`runGeneration`) drives every external asset job (image, video, voice,
// music, transcription) through a uniform submit → poll → normalized-result
// lifecycle, regardless of which provider (fal.ai today, direct vendors later)
// actually runs the model.
//
// Design mirrors the LLM caller in ../providers/index.js: env-key based,
// provider-agnostic, best-provider-first selection. Async by default because
// image/video generation takes minutes — callers run this from the worker, not
// a request handler.

import { elevenlabsProvider } from "./providers/elevenlabs.js";
import { systemProvider } from "./providers/system.js";
import { runwayProvider } from "./providers/runway.js";
import { falProvider } from "./providers/fal.js";
import { kieProvider } from "./providers/kie.js";
import { mockProvider } from "./providers/mock.js";
import {
  CAPABILITY,
  assertParams,
  estimateCost,
  isKnownCapability,
} from "./capabilities.js";

export { CAPABILITY, estimateCost };

// Registered media-gen providers. elevenlabs is a REAL synchronous TTS path
// (preferred for speech); fal + kie are real queue-based aggregators; mock is
// the offline fallback (only "available" when opted in via env). When
// GENERATION_MOCK=1, mock is checked FIRST so tests never hit a real API.
// system (free OS TTS) sits right after elevenlabs so speech always has a real
// fallback when the paid path 402s — submit-phase fallback in runGeneration
// rolls to it automatically.
const REAL_PROVIDERS = [elevenlabsProvider, systemProvider, runwayProvider, falProvider, kieProvider];
const MOCK_ON = process.env.GENERATION_MOCK === "1" || process.env.GENERATION_MOCK === "true";
const PROVIDERS = MOCK_ON ? [mockProvider, ...REAL_PROVIDERS] : [...REAL_PROVIDERS, mockProvider];

// Routing preferences via env:
//   GENERATION_PREFER=kie,fal                 → global priority order
//   GENERATION_PROVIDER_IMAGE_TO_VIDEO=kie    → force one provider for a capability
function preferenceOrder() {
  return (process.env.GENERATION_PREFER || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function forcedProvider(capability) {
  return (process.env[`GENERATION_PROVIDER_${capability.toUpperCase()}`] || "").trim().toLowerCase() || null;
}

/** Providers that are configured AND support the capability, in preference order. */
function candidates(capability) {
  const forced = forcedProvider(capability);
  let list = PROVIDERS.filter((p) => p.available() && p.supports.has(capability));
  if (forced) list = list.filter((p) => p.name === forced);
  const prefs = preferenceOrder();
  if (prefs.length) {
    list = [...list].sort((a, b) => {
      const ai = prefs.indexOf(a.name);
      const bi = prefs.indexOf(b.name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }
  return list;
}

/** Ordered names of providers that can serve a capability (diagnostics/tests). */
export function providersFor(capability) {
  return candidates(capability).map((p) => p.name);
}

/** True if some configured provider can serve this capability. */
export function hasGenerationProvider(capability) {
  if (capability) return candidates(capability).length > 0;
  return PROVIDERS.some((p) => p.available());
}

/**
 * Which provider the hybrid (recipe-driven) renderer should use for footage.
 * Shared by the worker's full pipeline and the API's single-scene regenerate
 * route so both pick the same provider.
 */
export function preferredHybridProvider() {
  const forced =
    process.env.HYBRID_VIDEO_PROVIDER ||
    process.env.GENERATION_VIDEO_PROVIDER ||
    process.env.GENERATION_PROVIDER_TEXT_TO_VIDEO ||
    "";
  if (forced.trim()) return forced.trim().toLowerCase();

  const videoProviders = providersFor("text_to_video");
  if (videoProviders.includes("kie")) return "kie";
  return undefined;
}

function selectProvider(capability, requested) {
  if (requested) {
    const p = PROVIDERS.find((x) => x.name === requested);
    if (!p) throw new Error(`Unknown generation provider: ${requested}`);
    if (!p.available()) throw new Error(`Generation provider "${requested}" is not configured.`);
    if (!p.supports.has(capability)) throw new Error(`Provider "${requested}" does not support ${capability}.`);
    return p;
  }
  const list = candidates(capability);
  if (!list.length) {
    throw new Error(
      `No generation provider available for "${capability}". Set FAL_KEY in backend/.env (or GENERATION_MOCK=1 for offline testing).`
    );
  }
  return list[0];
}

/**
 * Run one generation job end-to-end.
 *
 * @param {object} o
 * @param {string} o.capability        one of CAPABILITY.*
 * @param {object} o.params            normalized params (see capabilities.js `required`)
 * @param {string} [o.provider]        force a specific provider by name
 * @param {(e:{stage:string,progress?:number,costUsd?:number})=>void} [o.onProgress]
 * @param {number} [o.pollIntervalMs]  default 3000
 * @param {number} [o.timeoutMs]       default 600000 (10 min)
 * @returns {Promise<{ ok:boolean, capability:string, provider:string, assets?:any[], costUsd:number, error?:string, raw?:any }>}
 */
export async function runGeneration({
  capability,
  params = {},
  provider,
  onProgress = () => {},
  pollIntervalMs = 3000,
  timeoutMs = 600000,
}) {
  if (!isKnownCapability(capability)) throw new Error(`Unknown capability: ${capability}`);
  assertParams(capability, params);

  // Explicit provider → just that one; otherwise the full ordered candidate
  // list so a failed SUBMIT can fall back to the next provider (e.g. ElevenLabs
  // 402 → system SAPI). Once a job is submitted we do NOT fall back mid-poll —
  // that could double-spend on a paid provider.
  const chosen = provider ? [selectProvider(capability, provider)] : candidates(capability);
  if (!chosen.length) {
    throw new Error(
      `No generation provider available for "${capability}". Set FAL_KEY/KIE_API_KEY in backend/.env (or GENERATION_MOCK=1 for offline testing).`
    );
  }
  const costUsd = estimateCost(capability, params);

  let lastErr;
  for (const prov of chosen) {
    let handle;
    try {
      onProgress({ stage: "submitting", provider: prov.name, costUsd });
      handle = await prov.submit(capability, params);
    } catch (err) {
      lastErr = err;
      console.warn(`[generation] ${prov.name} submit failed: ${err?.message || err}. Trying next provider…`);
      continue;
    }
    handle.capability = capability; // some normalizers (fal) need it at poll time
    const jobId = handle.jobId;
    const started = Date.now();
    for (;;) {
      let res;
      try {
        res = await prov.poll(jobId, handle);
      } catch (err) {
        return { ok: false, capability, provider: prov.name, error: String(err?.message || err), costUsd };
      }
      if (res.status === "done") {
        onProgress({ stage: "done", progress: 1, provider: prov.name, costUsd });
        return { ok: true, capability, provider: prov.name, assets: res.assets || [], costUsd, raw: res.raw };
      }
      if (res.status === "failed") {
        return { ok: false, capability, provider: prov.name, error: res.error || "generation failed", costUsd };
      }
      onProgress({ stage: res.status || "running", progress: res.progress, provider: prov.name });
      if (Date.now() - started > timeoutMs) {
        return { ok: false, capability, provider: prov.name, error: "generation timed out", costUsd };
      }
      await sleep(pollIntervalMs);
    }
  }
  throw lastErr || new Error(`No provider could start ${capability}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Bridge for buildVideoPlan.js — speaks the scenePlan "operation" vocabulary
 * (text_to_video / image_to_video / video_to_video / reference_to_video) and
 * the snake_case params from the plan, and returns the resolved clip as
 * { url, path } (whichever the provider produced).
 *
 * @returns {Promise<{ url?:string, path?:string }>}
 */
export async function generateClip({
  provider,
  operation,
  prompt,
  image_path,
  source_video_path,
  reference_image_paths,
  durationSeconds,
  aspect_ratio,
  taskId,
} = {}) {
  const capability = operation; // operation names already equal CAPABILITY values
  const result = await runGeneration({
    capability,
    provider,
    params: {
      prompt,
      imageUrl: image_path || undefined,
      sourceVideoUrl: source_video_path || undefined,
      referenceImages: reference_image_paths || undefined,
      durationSec: durationSeconds,
      aspectRatio: aspect_ratio,
      taskId,
    },
  });
  if (!result.ok) {
    throw new Error(`generateClip(${operation}) failed: ${result.error}`);
  }
  const asset = result.assets?.[0] || {};
  return { url: asset.url, path: asset.path };
}
