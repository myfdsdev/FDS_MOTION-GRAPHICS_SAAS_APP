import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "./remotion/webpackOverride.js";
import { generateComponent, fixComponent } from "./src/lib/codegen.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(__dirname, "remotion", "index.jsx");
const SCENE_PATH = path.join(__dirname, "remotion", "scenes", "UserComposition.tsx");

function usage() {
  console.log('Usage: npm run gen -- "your video prompt" [--dur 20] [--aspect 16:9] [--premium] [-o out.mp4]');
}

function parseArgs(argv) {
  const args = { prompt: "", durationSec: 20, aspect: "16:9", premium: false, out: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dur" || a === "--duration") args.durationSec = Number(argv[++i]) || 20;
    else if (a === "--aspect") args.aspect = argv[++i] || "16:9";
    else if (a === "--premium") args.premium = true;
    else if (a === "-o" || a === "--out") args.out = argv[++i];
    else if (a === "-h" || a === "--help") args.help = true;
    else rest.push(a);
  }
  args.prompt = rest.join(" ").trim();
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.prompt || args.help) {
    usage();
    process.exit(args.prompt ? 0 : 1);
  }

  const slug = args.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "video";
  const outputPath = args.out
    ? path.resolve(args.out)
    : path.resolve(__dirname, "public", "videos", `${slug}-${Date.now()}.mp4`);

  console.log(`[gen] prompt: "${args.prompt}"`);
  console.log(`[gen] ${args.aspect}, ${args.durationSec}s, ${args.premium ? "premium" : "standard"} tier`);

  // 1. Code-gen → validated .tsx
  const { source, brief, width, height, durationInFrames } = await generateComponent({
    prompt: args.prompt,
    durationSec: args.durationSec,
    aspect: args.aspect,
    premium: args.premium,
    onProgress: (stage) => console.log(`[gen] ${stage}…`),
  });
  console.log(`[gen] brief: ${brief.slice(0, 120)}${brief.length > 120 ? "…" : ""}`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  console.log("[gen] ensuring Remotion browser…");
  await ensureBrowser();

  const inputProps = { aspectRatio: args.aspect, durationInFrames };

  // 2-3. Write → bundle → render, with up to 2 self-repair attempts if the
  // component crashes at bundle/render time (hallucinated API, runtime error).
  let current = source;
  const MAX_RENDER_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_RENDER_ATTEMPTS; attempt++) {
    fs.mkdirSync(path.dirname(SCENE_PATH), { recursive: true });
    fs.writeFileSync(SCENE_PATH, current, "utf8");
    console.log(`[gen] wrote component → ${path.relative(__dirname, SCENE_PATH)} (${current.length} chars)`);

    try {
      console.log(`[gen] bundling… (attempt ${attempt}/${MAX_RENDER_ATTEMPTS})`);
      const serveUrl = await bundle({ entryPoint: ENTRY, webpackOverride });
      const composition = await selectComposition({ serveUrl, id: "video", inputProps });

      console.log(`[gen] rendering → ${outputPath}`);
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        onProgress: ({ progress }) => {
          const pct = Math.round(progress * 100);
          process.stdout.write(`\r[gen] render ${String(pct).padStart(3, " ")}%`);
        },
      });
      process.stdout.write("\n");
      console.log(`[gen] done: ${outputPath}`);
      console.log(`[gen] (dimensions ${width}x${height})`);
      return;
    } catch (renderErr) {
      const msg = renderErr instanceof Error ? renderErr.message : String(renderErr);
      process.stdout.write("\n");
      console.warn(`[gen] render failed: ${msg.slice(0, 200)}`);
      if (attempt === MAX_RENDER_ATTEMPTS) throw renderErr;
      console.log("[gen] asking the model to repair the component…");
      current = await fixComponent({ brokenSource: current, error: msg });
    }
  }
}

main().catch((err) => {
  console.error(`\n[gen] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
