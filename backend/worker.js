import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { connectDB } from "./src/db.js";
import { Project } from "./src/models.js";
import { costForDuration, refundCredits } from "./src/lib/credits.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = path.join(__dirname, "public", "videos");
const ENTRY = path.join(__dirname, "remotion", "index.jsx");
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const POLL_MS = 2000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  await connectDB();

  console.log("[worker] ensuring headless browser (first run downloads Chrome)…");
  await ensureBrowser();

  console.log("[worker] bundling Remotion compositions…");
  const serveUrl = await bundle({ entryPoint: ENTRY });
  console.log("[worker] bundle ready. Polling for QUEUED projects…");

  // Single-concurrency poll loop. Claiming via QUEUED -> RENDERING is the lock.
  for (;;) {
    let job = null;
    try {
      job = await Project.findOneAndUpdate(
        { status: "QUEUED", deletedAt: null },
        { status: "RENDERING", progress: 35 },
        { sort: { createdAt: 1 }, new: true }
      );
    } catch (err) {
      console.error("[worker] claim error:", err);
    }

    if (!job) {
      await sleep(POLL_MS);
      continue;
    }

    await renderProject(serveUrl, job);
  }
}

async function renderProject(serveUrl, project) {
  const id = String(project._id);
  console.log(`[worker] rendering project ${id} (${project.aspectRatio}, ${project.durationSec}s)…`);

  try {
    if (!project.sceneJson) throw new Error("Project has no scene plan to render");

    const inputProps = project.sceneJson;
    const composition = await selectComposition({ serveUrl, id: "video", inputProps });
    const outPath = path.join(VIDEOS_DIR, `${id}.mp4`);

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outPath,
      inputProps,
      onProgress: ({ progress }) => {
        const pct = Math.min(99, Math.round(35 + progress * 60));
        Project.updateOne({ _id: id }, { progress: pct }).catch(() => {});
      },
    });

    await Project.updateOne(
      { _id: id },
      {
        status: "DONE",
        progress: 100,
        outputUrl: `${PUBLIC_BASE}/videos/${id}.mp4`,
        errorMessage: null,
      }
    );
    console.log(`[worker] ✓ done ${id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render failed";
    console.error(`[worker] ✗ render ${id} failed:`, err);
    await Project.updateOne(
      { _id: id },
      { status: "FAILED", progress: 0, errorMessage: message, outputUrl: null }
    );
    await refundCredits(String(project.userId), costForDuration(project.durationSec), id).catch(
      (refundErr) => console.error(`[worker] refund failed for ${id}:`, refundErr)
    );
  }
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
