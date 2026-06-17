// Proof: render the plan-driven "scene" composition end-to-end → real MP4.
// Color backgrounds + motion-graphics overlays + real SAPI narration. No keys.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "./remotion/webpackOverride.js";
import { runGeneration, CAPABILITY } from "./src/lib/generation/index.js";

const ENTRY = path.resolve("remotion/index.jsx");
const OUT = path.resolve("public/videos/scene-demo.mp4");

const tts = await runGeneration({
  capability: CAPABILITY.TEXT_TO_SPEECH,
  params: { text: "Re-Motion builds your video from a single prompt. Footage, motion graphics, and voice, merged automatically." },
});
if (!tts.ok) throw new Error("tts failed: " + tts.error);
console.log("narration:", tts.assets[0].path, "via", tts.provider);

const plan = {
  scenes: [
    { id: "s1", durationSeconds: 3, background: { kind: "color", color: "#0B1220", scrim: 0.4 },
      overlays: [{ type: "heroTitle", props: { title: "RE-MOTION", subtitle: "Prompt to finished video" } }] },
    { id: "s2", durationSeconds: 4, background: { kind: "color", color: "#11161D", scrim: 0.4 },
      overlays: [{ type: "barChart", props: { title: "Videos generated", data: [{label:"Jan",value:30},{label:"Feb",value:55},{label:"Mar",value:90}], animationStyle: "grow-up" } }] },
    { id: "s3", durationSeconds: 3, background: { kind: "color", color: "#0B1220", scrim: 0.4 },
      overlays: [{ type: "statReveal", props: { stat: "1M+", label: "videos made" } }] },
  ],
  // staticFile-relative path (under public/) — Remotion can't load file:/// URLs
  narration: { src: `tts/${path.basename(tts.assets[0].path)}`, volume: 1 },
};

console.log("bundling…");
const serveUrl = await bundle({ entryPoint: ENTRY, webpackOverride, publicDir: path.resolve("public") });
await ensureBrowser();
const inputProps = { aspectRatio: "16:9", plan };
const comp = await selectComposition({ serveUrl, id: "scene", inputProps });
console.log(`composition "scene": ${comp.width}x${comp.height}, ${comp.durationInFrames}f (${comp.durationInFrames/30}s)`);

await renderMedia({ composition: comp, serveUrl, codec: "h264", outputLocation: OUT, inputProps });
const st = fs.statSync(OUT);
console.log(`\n✅ REAL plan-driven MP4: ${OUT} (${(st.size/1024).toFixed(1)} KB)`);
