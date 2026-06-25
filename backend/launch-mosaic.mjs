import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "./remotion/webpackOverride.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(__dirname, "remotion", "index.jsx");
const out = path.join(__dirname, "public", "videos", "mosaic-motion-launch.mp4");

// Launch video for "Mosaic Motion" — text-to-motion-graphics. Pure motion
// graphics (no footage). Each scene is its own colour world; ends on the
// animated logo.
const plan = {
  scenes: [
    {
      id: "s1",
      durationSeconds: 3.4,
      background: { kind: "color", color: "#0A0A14", scrim: 0 },
      overlays: [{ type: "kineticTitle", props: { title: "IMAGINE IT", subtitle: "Then watch it move", gradient: ["#22D3EE", "#A78BFA"], bg: "#0A0A14", accent: "#22D3EE" } }],
    },
    {
      id: "s2",
      durationSeconds: 4.0,
      background: { kind: "color", color: "#0B0A16", scrim: 0 },
      overlays: [{ type: "kineticTitle", props: { title: "MOSAIC MOTION", subtitle: "Turn words into motion", gradient: ["#A78BFA", "#F472B6"], bg: "#0B0A16", accent: "#A78BFA" } }],
    },
    {
      id: "s3",
      durationSeconds: 3.2,
      background: { kind: "color", color: "#07120F", scrim: 0 },
      overlays: [{ type: "kineticTitle", props: { title: "JUST DESCRIBE IT", subtitle: "No timelines. No editors.", gradient: ["#34D399", "#22D3EE"], bg: "#07120F", accent: "#34D399" } }],
    },
    {
      id: "s4",
      durationSeconds: 3.4,
      background: { kind: "color", color: "#140A0A", scrim: 0 },
      overlays: [{ type: "kineticTitle", props: { title: "STUDIO-GRADE", subtitle: "Beautiful motion, every time", gradient: ["#F59E0B", "#FB7185"], bg: "#140A0A", accent: "#FB7185" } }],
    },
    {
      id: "s5",
      durationSeconds: 3.2,
      background: { kind: "color", color: "#0A0E1A", scrim: 0 },
      overlays: [{ type: "kineticTitle", props: { title: "IN SECONDS", subtitle: "From idea to video", gradient: ["#818CF8", "#22D3EE"], bg: "#0A0E1A", accent: "#818CF8" } }],
    },
    {
      id: "s6",
      durationSeconds: 5.2,
      background: { kind: "color", color: "#0A0A14", scrim: 0 },
      overlays: [{ type: "logoReveal", props: { brand: "MOSAIC MOTION", tagline: "Words into motion", cta: "Start creating", gradient: ["#22D3EE", "#A78BFA"], bg: "#0A0A14", accent: "#A78BFA" } }],
    },
  ],
};

const inputProps = { aspectRatio: "16:9", plan };

console.log("ensuring browser…");
await ensureBrowser();
console.log("bundling…");
const serveUrl = await bundle({ entryPoint: ENTRY, webpackOverride, publicDir: path.join(__dirname, "public") });
const composition = await selectComposition({ serveUrl, id: "scene", inputProps });
console.log(`rendering ${composition.width}x${composition.height} ${composition.durationInFrames}f → ${out}`);
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation: out,
  inputProps,
  concurrency: 2,
  offthreadVideoCacheSizeInBytes: 256 * 1024 * 1024,
  onProgress: ({ progress }) => process.stdout.write(`\r${Math.round(progress * 100)}%`),
});
console.log(`\ndone: ${out}`);
