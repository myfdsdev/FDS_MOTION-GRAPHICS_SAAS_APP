// imagePlan — turn the user's uploaded images INTO the video.
//
// The vision model looks at the images (in order), writes one flowing voiceover
// that tells a story across them, and a short caption per image. We then build a
// scenePlan where each image is a scene background (the SceneRenderer gives it a
// slow Ken-Burns push-in). Narration + captions + music are added by the worker,
// exactly like the normal hybrid path.
//
// "Mix both" (some scenes animated via kie image-to-video) is supported by
// flagging a scene's background as { kind:"video", source:"generate", asset.image }
// — but kie must be able to FETCH the image (needs a public URL). Locally the
// image sits on localhost which kie can't reach, so we keep images as exact
// stills unless PUBLIC_BASE is publicly reachable (ANIMATE_IMAGES=1 to force).

import fs from "node:fs";
import path from "node:path";
import { getProviderKey } from "../providerKeys.js";
import { mimeFromPath, PUBLIC_DIR } from "./imageStore.js";

/** Ask the vision model to describe the images and script a voiceover. */
async function analyzeImages(absPaths, prompt, durationSec) {
  const key = getProviderKey("gemini") || process.env.GEMINI_API_KEY;
  if (!key || !absPaths.length) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const words = Math.round(Math.max(4, durationSec) * 2.3);

  const sys = [
    `You are scripting a short video built from the user's own ${absPaths.length} photos, shown IN ORDER.`,
    `Look at every image. Return ONLY JSON, no markdown:`,
    `{"narration":"<ONE flowing spoken voiceover, about ${words} words, that narrates a story/observation across these exact images in order>",`,
    `"titles":["<very short on-screen caption for image 1>", ... exactly ${absPaths.length} short captions]}`,
    prompt ? `The user's note about the video: ${prompt}` : "",
    `Ground everything in what is actually visible in the images. JSON only.`,
  ].join("\n");

  const parts = [{ text: sys }];
  for (const p of absPaths) {
    try {
      parts.push({ inline_data: { mime_type: mimeFromPath(p), data: fs.readFileSync(p).toString("base64") } });
    } catch {
      /* skip unreadable image */
    }
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.7 } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const slice = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const obj = JSON.parse(slice);
    return {
      narration: String(obj.narration || "").trim(),
      titles: Array.isArray(obj.titles) ? obj.titles.map((t) => String(t || "").trim()) : [],
    };
  } catch {
    return null;
  }
}

/**
 * Build a scenePlan from a project's uploaded images.
 * @param {object} project  Mongoose project (needs images[], prompt, durationSec, aspectRatio, narration)
 * @returns {Promise<object>} scenePlan (image-background scenes)
 */
export async function buildImageScenePlan(project) {
  const images = (project.images || []).filter(Boolean).slice(0, 8);
  const aspect = project.aspectRatio || "16:9";
  const total = Math.max(4, Number(project.durationSec) || 20);
  const per = Math.max(2, Math.round((total / images.length) * 10) / 10);

  const absPaths = images.map((rel) => path.join(PUBLIC_DIR, rel.replace(/^\/+/, "")));
  const vision = await analyzeImages(absPaths, project.prompt, total).catch(() => null);
  const titles = vision?.titles || [];

  // Some scenes animate via kie only when images are publicly reachable.
  const animate = process.env.ANIMATE_IMAGES === "1";

  const scenes = images.map((rel, i) => {
    const src = rel.replace(/^\/+/, "");
    const animThis = animate && i % 2 === 1; // "mix": every other image
    return {
      id: `s${i + 1}`,
      durationSeconds: per,
      description: titles[i] || project.prompt || `Image ${i + 1}`,
      background: animThis
        ? { kind: "video", source: "generate", scrim: 0 }
        : { kind: "image", src, scrim: 0 },
      // when animating, hand kie the image + a motion prompt
      asset: animThis ? { image: src, prompt: titles[i] || project.prompt || "subtle cinematic motion" } : undefined,
      overlays: [],
    };
  });

  const script =
    vision?.narration ||
    (project.prompt ? `${project.prompt}` : "A short story told through these moments.");

  return {
    version: "1.0",
    aspectRatio: aspect,
    scenes,
    narration: project.narration !== false ? { script } : undefined,
    recipeId: "image-video",
  };
}
