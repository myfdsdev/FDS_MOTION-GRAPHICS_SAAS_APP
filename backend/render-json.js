import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { VideoPlanSchema } from "./src/schemas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(__dirname, "remotion", "index.jsx");

function usage() {
  console.log("Usage: npm run render:json -- <input.json> [output.mp4]");
  console.log("Input can be a VideoPlan, { plan: VideoPlan }, or { sceneJson: VideoPlan }.");
}

function readPlan(inputPath) {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const candidate = raw?.sceneJson ?? raw?.plan ?? raw;
  const parsed = VideoPlanSchema.safeParse(candidate);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const location = issue?.path?.length ? issue.path.join(".") : "root";
    throw new Error(`Invalid video JSON at ${location}: ${issue?.message ?? "schema mismatch"}`);
  }

  return parsed.data;
}

async function main() {
  const inputArg = process.argv[2];
  const outputArg = process.argv[3];

  if (!inputArg || inputArg === "-h" || inputArg === "--help") {
    usage();
    process.exit(inputArg ? 0 : 1);
  }

  const inputPath = path.resolve(inputArg);
  const outputPath = outputArg
    ? path.resolve(outputArg)
    : path.resolve(__dirname, "public", "videos", `${path.basename(inputPath, ".json")}.mp4`);

  const plan = readPlan(inputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  console.log(`[render-json] validating OK: ${plan.template}, ${plan.aspectRatio}, ${plan.duration}s`);
  console.log("[render-json] ensuring Remotion browser...");
  await ensureBrowser();

  console.log("[render-json] bundling composition...");
  const serveUrl = await bundle({ entryPoint: ENTRY });
  const composition = await selectComposition({ serveUrl, id: "video", inputProps: plan });

  console.log(`[render-json] rendering MP4 -> ${outputPath}`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: plan,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      process.stdout.write(`\r[render-json] progress ${String(pct).padStart(3, " ")}%`);
    },
  });

  process.stdout.write("\n");
  console.log(`[render-json] done: ${outputPath}`);
}

main().catch((err) => {
  console.error(`[render-json] failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
