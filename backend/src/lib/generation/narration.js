// Narration synthesis — turn a scenePlan's narration.script into a real audio
// file the SceneRenderer can play. Uses the generation engine's text-to-speech
// (ElevenLabs if configured, else free Windows SAPI). Returns a staticFile-
// relative src ("tts/<file>") because Remotion can't load file:// URLs — the
// worker must bundle with publicDir=public.

import path from "node:path";
import { runGeneration, CAPABILITY } from "./index.js";

/**
 * @param {string} script  spoken voiceover text
 * @param {{ voice?: string }} [opts]
 * @returns {Promise<{ src: string, path: string } | null>} null if no script / TTS unavailable
 */
export async function synthesizeNarration(script, opts = {}) {
  const text = String(script || "").trim();
  if (!text) return null;
  const r = await runGeneration({
    capability: CAPABILITY.TEXT_TO_SPEECH,
    params: { text, voice: opts.voice },
  });
  if (!r.ok || !r.assets?.[0]?.path) return null;
  const asset = r.assets[0];
  return { src: `tts/${path.basename(asset.path)}`, path: asset.path };
}
