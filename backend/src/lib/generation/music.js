// Music synthesis — turn a short brief into a background music track the
// SceneRenderer can play under the narration. Uses the generation engine's
// MUSIC capability (kie's Suno API). kie returns a hosted https audioUrl, which
// the renderer loads directly (no local download needed, unlike SAPI TTS).

import { runGeneration, CAPABILITY } from "./index.js";

/**
 * @param {string} brief  description of the desired music (genre/mood/instrumentation)
 * @param {{ provider?: string, instrumental?: boolean, model?: string, style?: string,
 *           title?: string, customMode?: boolean }} [opts]
 * @returns {Promise<{ src: string } | null>} null if no brief / generation failed
 */
export async function synthesizeMusic(brief, opts = {}) {
  const prompt = String(brief || "").trim();
  if (!prompt) return null;

  const r = await runGeneration({
    capability: CAPABILITY.MUSIC,
    provider: opts.provider || "kie", // Suno lives on kie
    params: {
      prompt,
      instrumental: opts.instrumental ?? true, // sits UNDER the voiceover
      model: opts.model,
      style: opts.style,
      title: opts.title,
      customMode: opts.customMode,
    },
  });

  if (!r.ok) return null;
  const asset = r.assets?.[0] || {};
  const src = asset.url || asset.path;
  return src ? { src } : null;
}
