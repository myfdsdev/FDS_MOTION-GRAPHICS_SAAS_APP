// Generation job orchestrator — runs inside the worker. Takes a project brief
// (script, shot list, music mood, etc.) and drives the full:
// generation (TTS/images/video) → composition → output MP4
//
// Designed to integrate with existing worker.js polling loop.

import { runGeneration, CAPABILITY } from "./index.js";
import { reserveBudget, reconcileCost } from "./cost.js";
import { composeVideo } from "./compose.js";

/**
 * Run one full generation+compose job. Callers (worker.js) submit this with
 * a projectId + a brief containing what to generate.
 *
 * @param {object} o
 * @param {string} o.projectId
 * @param {string} o.userId
 * @param {object} o.brief        { videoType, script, shotList, musicMood, ... }
 * @param {function} [o.onProgress]
 * @returns {Promise<{ ok:boolean, outputUrl?, error?, durationSec? }>}
 */
export async function runGenerationJob({ projectId, userId, brief = {}, onProgress = () => {} }) {
  const videoType = brief.videoType || "hybrid"; // hybrid | pure-ai | talking-head
  const assets = { videoClips: [], narration: null, music: null, captions: null };

  try {
    // ---- PHASE 1: Generate assets ----
    onProgress({ phase: "generation", stage: "narration" });

    // 1a. TTS narration (text → audio)
    if (brief.script) {
      const narRes = await runGeneration({
        capability: CAPABILITY.TEXT_TO_SPEECH,
        params: { text: brief.script },
        onProgress: (e) => onProgress({ phase: "generation", stage: `narration_${e.stage}`, progress: e.progress }),
      });
      if (!narRes.ok) throw new Error(`TTS failed: ${narRes.error}`);
      assets.narration = narRes.assets[0];
    }

    // 1b. Music generation
    if (brief.musicMood) {
      onProgress({ phase: "generation", stage: "music" });
      const musicRes = await runGeneration({
        capability: CAPABILITY.MUSIC,
        params: { prompt: brief.musicMood, durationSec: brief.durationSec || 30 },
        onProgress: (e) => onProgress({ phase: "generation", stage: `music_${e.stage}`, progress: e.progress }),
      });
      if (!musicRes.ok) throw new Error(`Music failed: ${musicRes.error}`);
      assets.music = musicRes.assets[0];
    }

    // 1c. Video clips (image→video or text→video per shot)
    if (brief.shots && Array.isArray(brief.shots)) {
      for (let i = 0; i < brief.shots.length; i++) {
        const shot = brief.shots[i];
        onProgress({ phase: "generation", stage: `video_${i + 1}_of_${brief.shots.length}` });

        let clipRes;
        if (shot.imageUrl) {
          // Image-to-video
          clipRes = await runGeneration({
            capability: CAPABILITY.IMAGE_TO_VIDEO,
            params: { imageUrl: shot.imageUrl, durationSec: shot.durationSec || 5 },
            onProgress: (e) =>
              onProgress({ phase: "generation", stage: `video_${i + 1}_${e.stage}`, progress: e.progress }),
          });
        } else if (shot.prompt) {
          // Text-to-video
          clipRes = await runGeneration({
            capability: CAPABILITY.TEXT_TO_VIDEO,
            params: { prompt: shot.prompt, durationSec: shot.durationSec || 5 },
            onProgress: (e) =>
              onProgress({ phase: "generation", stage: `video_${i + 1}_${e.stage}`, progress: e.progress }),
          });
        }

        if (clipRes && !clipRes.ok) throw new Error(`Video shot ${i + 1} failed: ${clipRes.error}`);
        if (clipRes?.assets?.[0]) assets.videoClips.push(clipRes.assets[0]);
      }
    }

    // 1d. Captions (transcribe narration or from brief)
    if (assets.narration || brief.captions) {
      onProgress({ phase: "generation", stage: "captions" });
      // If brief has captions data, use it; else transcribe the narration audio.
      if (brief.captions) {
        assets.captions = brief.captions;
      } else if (assets.narration?.url) {
        const capRes = await runGeneration({
          capability: CAPABILITY.TRANSCRIBE,
          params: { audioUrl: assets.narration.url },
          onProgress: (e) => onProgress({ phase: "generation", stage: `captions_${e.stage}`, progress: e.progress }),
        });
        if (capRes?.ok && capRes.assets?.[0]) {
          assets.captions = capRes.assets[0];
        }
      }
    }

    // ---- PHASE 2: Compose into final video ----
    onProgress({ phase: "composition", stage: "assembling" });
    const outputPath = `backend/public/videos/${projectId}.mp4`;
    const compRes = await composeVideo({
      recipe: videoType,
      assets,
      outputPath,
      onProgress: (e) => onProgress({ phase: "composition", stage: e.stage, progress: e.progress }),
    });

    if (!compRes.ok) throw new Error(`Composition failed: ${compRes.error}`);

    onProgress({ phase: "done", progress: 1 });
    return {
      ok: true,
      outputUrl: `/videos/${projectId}.mp4`,
      durationSec: compRes.durationSec,
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}
