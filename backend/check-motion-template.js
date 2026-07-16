// TEMP diagnostic (safe to delete): live-check the motion-graphics template path.
// Runs the REAL planner (Gemini) with a graphics recipe, then renders the REAL
// "scene" composition — but forces color backgrounds + no audio so it spends
// zero kie/TTS credits. Output: public/videos/motion-check-<recipe>.mp4
//
// Usage: node check-motion-template.js [recipeId] ["prompt text"]

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { planScenes } from "./src/lib/generation/planScenes.js";
import { webpackOverride } from "./remotion/webpackOverride.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const recipe = process.argv[2] || "kinetic-typography";
const prompt =
  process.argv[3] ||
  "A punchy motivational video for a coffee brand called BREW HAUS: bold lines about starting the day strong. Target duration: 15s.";

const t0 = Date.now();
const log = (m) => console.log(`[check +${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

log(`planning scenes with recipe="${recipe}" via LLM…`);
const scenePlan = await planScenes(prompt, { recipe, aspectRatio: "16:9" });
log(`planner returned ${scenePlan.scenes.length} scenes (recipeId=${scenePlan.recipeId})`);

// Report what the planner actually asked for, scene by scene.
for (const [i, s] of scenePlan.scenes.entries()) {
  const bg = s.background || {};
  const overlays = (s.overlays || []).map((o) => o.type).join(", ") || "none";
  console.log(
    `  scene ${i + 1}: ${s.durationSeconds}s | bg=${bg.kind}${
      bg.source === "generate" ? " (GENERATE!)" : ""
    } ${bg.color || ""} | overlays: ${overlays}`
  );
}

if (scenePlan.theme) console.log(`  theme: ${JSON.stringify(scenePlan.theme)}`);

// Safety: coerce any footage scene to a flat color so nothing is generated.
let coerced = 0;
for (const s of scenePlan.scenes) {
  if (s.background?.kind !== "color") {
    s.background = { kind: "color", color: scenePlan.theme?.bg, scrim: 0 };
    coerced++;
  }
}
if (coerced) log(`coerced ${coerced} non-color background(s) to color (no spend)`);

// no narration/music/captions — visual check only
const videoPlan = { scenes: scenePlan.scenes, theme: scenePlan.theme };

log("bundling remotion project…");
const serveUrl = await bundle({
  entryPoint: path.join(__dirname, "remotion", "index.jsx"),
  webpackOverride,
  publicDir: path.join(__dirname, "public"),
});

const inputProps = { aspectRatio: "16:9", plan: videoPlan };
const composition = await selectComposition({ serveUrl, id: "scene", inputProps });
log(`composition: ${composition.width}x${composition.height}, ${composition.durationInFrames} frames`);

const outPath = path.join(__dirname, "public", "videos", `motion-check-${recipe}.mp4`);
log("rendering…");
await renderMedia({
  serveUrl,
  composition,
  codec: "h264",
  outputLocation: outPath,
  inputProps,
  concurrency: 2,
  timeoutInMilliseconds: 120000,
  offthreadVideoCacheSizeInBytes: 512 * 1024 * 1024,
  onProgress: ({ progress }) => {
    const pct = Math.round(progress * 100);
    if (pct % 20 === 0) process.stdout.write(`\r  render ${pct}%   `);
  },
});
console.log("");
log(`DONE → ${outPath}`);
