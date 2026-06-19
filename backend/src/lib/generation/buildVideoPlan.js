// src/lib/generation/buildVideoPlan.js
//
// Turns a validated LLM scene plan into a render-ready `videoPlan`:
//   1. fan-out  — generate one clip per scene whose background is "generate"
//   2. gather   — map finished assets back onto the scenes
//   3. return the plan the SceneRenderer composition consumes
//
// Routing by generation mode (text/image/video -> video) reuses the providers
// in src/lib/generation/providers/*. Each provider call resolves to a { url }
// (R2) or { path } (local) for the clip.

import { generateClip } from "./index.js";

/**
 * Decide which provider operation a scene needs.
 *   - no source media            -> text_to_video
 *   - one still image            -> image_to_video
 *   - a source clip / references -> video_to_video / reference_to_video
 */
function pickOperation(scene) {
  const a = scene.asset || {};
  if (a.sourceVideo) return "video_to_video";
  if (a.referenceImages?.length) return "reference_to_video";
  if (a.image) return "image_to_video";
  return "text_to_video";
}

function usableGeneratedSrc(src) {
  if (!src || typeof src !== "string") return null;
  // The mock provider is for pipeline testing only; don't ask Remotion to load
  // a fake protocol as media.
  if (src.startsWith("mock://")) return null;
  return src;
}

function finiteNumber(value, fallback) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sceneDurationSeconds(scene) {
  return Math.max(0.1, finiteNumber(scene.durationSeconds, finiteNumber(scene.durationSec, 3)));
}

// trimBefore/trimAfter must be positive — Remotion rejects 0. The schema allows
// 0 (minimum 0), and the LLM sometimes emits 0, so drop non-positive trims here
// so they never reach the renderer.
function positiveOrUndefined(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function safeTaskId(...parts) {
  return parts
    .filter(Boolean)
    .join("_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
}

function shouldCreateStillFirst(ctx, operation) {
  if (operation !== "text_to_video") return false;
  if (ctx.provider !== "kie") return false;
  return process.env.KIE_IMAGE_TO_VIDEO_FIRST !== "0";
}

/**
 * @param {object} scenePlan  validated against scene_plan.schema
 * @param {object} ctx        { provider, aspectRatio, jobId, onProgress }
 * @returns {Promise<object>} videoPlan for SceneRenderer inputProps
 */
export async function buildVideoPlan(scenePlan, ctx = {}) {
  const { aspectRatio = scenePlan.aspectRatio || "16:9" } = ctx;

  // ---- 1. FAN-OUT: generate every "generate" background in parallel ----
  const generated = await Promise.all(
    scenePlan.scenes.map(async (scene) => {
      const wantsGenerate =
        scene.background?.kind === "video" &&
        scene.background?.source === "generate";

      if (!wantsGenerate) {
        return { id: scene.id, src: scene.background?.src ?? null };
      }

      let operation = pickOperation(scene);
      let imagePath = scene.asset?.image;
      const prompt = scene.asset?.prompt ?? scene.description;

      if (shouldCreateStillFirst(ctx, operation)) {
        const image = await generateClip({
          provider: ctx.provider,
          operation: "text_to_image",
          prompt,
          aspect_ratio: aspectRatio,
          jobId: ctx.jobId,
          taskId: safeTaskId("task", ctx.jobId, scene.id, "image"),
        });
        imagePath = image.url ?? image.path;
        operation = "image_to_video";
      }

      const result = await generateClip({
        provider: ctx.provider, // "runway" | "fal" | "kie" | ...
        operation, // text_to_video | image_to_video | video_to_video | reference_to_video
        prompt,
        image_path: imagePath,
        source_video_path: scene.asset?.sourceVideo,
        reference_image_paths: scene.asset?.referenceImages,
        durationSeconds: sceneDurationSeconds(scene),
        aspect_ratio: aspectRatio,
        jobId: ctx.jobId,
        taskId: safeTaskId("task", ctx.jobId, scene.id, operation),
      });

      ctx.onProgress?.({ sceneId: scene.id, operation });
      return { id: scene.id, src: usableGeneratedSrc(result.url ?? result.path) };
    }),
  );

  const srcById = Object.fromEntries(generated.map((g) => [g.id, g.src]));

  // ---- 2. GATHER: rebuild scenes with resolved asset paths -------------
  const scenes = scenePlan.scenes.map((scene) => ({
    id: scene.id,
    durationSeconds: sceneDurationSeconds(scene),
    fadeInFrames: scene.fadeInFrames,
    fadeOutFrames: scene.fadeOutFrames,
    background: {
      kind: srcById[scene.id] ? scene.background?.kind ?? "video" : "color",
      src: srcById[scene.id] ?? scene.background?.src,
      color: scene.background?.color ?? "#000",
      filter: scene.background?.filter,
      scrim: scene.background?.scrim ?? (scene.overlays?.length ? 0.4 : 0),
      trimBeforeSeconds: positiveOrUndefined(scene.background?.trimBeforeSeconds),
      trimAfterSeconds: positiveOrUndefined(scene.background?.trimAfterSeconds),
    },
    overlays: scene.overlays ?? [],
  }));

  // ---- 3. ASSEMBLE the videoPlan --------------------------------------
  return {
    scenes,
    narration: scenePlan.narration,
    music: scenePlan.music,
    captions: scenePlan.captions,
  };
}

/*
 * Render entry point (called by the render worker), composition id = "scene":
 *
 *   import { renderMedia, selectComposition } from "@remotion/renderer";
 *   const plan = await buildVideoPlan(scenePlan, { provider: "runway", aspectRatio });
 *   const comp = await selectComposition({
 *     serveUrl, id: "scene", inputProps: { aspectRatio, plan },
 *   });
 *   await renderMedia({
 *     composition: comp, serveUrl, codec: "h264",
 *     outputLocation: outPath, inputProps: { aspectRatio, plan },
 *   });
 *
 * Width/height/duration come from calculateSceneMetadata — do NOT pass them.
 */
