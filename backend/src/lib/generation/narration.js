// Narration synthesis — turn a scenePlan's narration.script into a real audio
// track the SceneRenderer can play.
//
// Provider order (best voice first, always lands somewhere real):
//   1. kie  — ElevenLabs voices via kie's Jobs API (model elevenlabs/
//             text-to-dialogue-v3). Real, natural voices on your kie credits.
//             Preferred because the DIRECT ElevenLabs key is free-tier blocked.
//   2. auto — the engine's normal order (direct ElevenLabs -> free Windows SAPI),
//             so narration still works with zero kie credits.
// Override with NARRATION_PROVIDER (e.g. "system" to force free SAPI).
//
// kie returns a hosted https URL (used directly); SAPI/ElevenLabs write a local
// file under public/tts, so we return a staticFile-relative "tts/<file>" — the
// worker must bundle with publicDir=public for those.

import path from "node:path";
import { runGeneration, providersFor, CAPABILITY } from "./index.js";

function assetToSrc(asset = {}) {
  if (asset.url && /^https?:\/\//i.test(asset.url)) return { src: asset.url, path: asset.path };
  if (asset.path) return { src: `tts/${path.basename(asset.path)}`, path: asset.path };
  return null;
}

/**
 * @param {string} script  spoken voiceover text
 * @param {{ voice?: string, stability?: number }} [opts]
 * @returns {Promise<{ src: string, path?: string } | null>} null if no script / TTS unavailable
 */
export async function synthesizeNarration(script, opts = {}) {
  const text = String(script || "").trim();
  if (!text) return null;

  // Build the ordered list of providers to attempt.
  const available = providersFor(CAPABILITY.TEXT_TO_SPEECH);
  const order = [];
  if (process.env.NARRATION_PROVIDER) order.push(process.env.NARRATION_PROVIDER.trim().toLowerCase());
  else if (available.includes("kie")) order.push("kie"); // prefer kie's real EL voices
  order.push(undefined); // auto — engine's own order with submit-phase fallback

  const params = {
    text,
    voice: opts.voice || process.env.KIE_TTS_VOICE,
    stability: opts.stability,
  };

  let lastErr;
  for (const provider of order) {
    try {
      const r = await runGeneration({ capability: CAPABILITY.TEXT_TO_SPEECH, provider, params });
      if (r.ok) {
        const out = assetToSrc(r.assets?.[0]);
        if (out) return out;
      }
      lastErr = r.error;
    } catch (e) {
      lastErr = e?.message || e;
    }
  }
  if (lastErr) console.warn(`[narration] all TTS providers failed: ${lastErr}`);
  return null;
}
