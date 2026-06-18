import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "./remotion/webpackOverride.js";
import { connectDB } from "./src/db.js";
import { Project } from "./src/models.js";
import { costForDuration, refundCredits } from "./src/lib/credits.js";
import { fixComponent } from "./src/lib/codegen.js";
import { isStorageConfigured, uploadFile } from "./src/lib/storage.js";
import { planScenes } from "./src/lib/generation/planScenes.js";
import { buildVideoPlan } from "./src/lib/generation/buildVideoPlan.js";
import { providersFor } from "./src/lib/generation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = path.join(__dirname, "public", "videos");
const ENTRY = path.join(__dirname, "remotion", "index.jsx");
const SCENE_PATH = path.join(__dirname, "remotion", "scenes", "UserComposition.tsx");
const FPS = 30;
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const POLL_MS = 2000;

// ---- Reliability knobs ----------------------------------------------------
// A render job is considered "stuck" if no progress update has happened for
// this long. The watchdog will fail / requeue it.
const STUCK_RENDER_MS = 8 * 60 * 1000; // 8 min
// Max times the worker will auto-retry a single project before marking it
// permanently FAILED. Prevents poison jobs from looping forever.
const MAX_AUTO_RETRIES = 2;
// How often the watchdog scans the queue.
const WATCHDOG_INTERVAL_MS = 30 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function previewFramesFor(durationInFrames) {
  const lastFrame = Math.max(0, durationInFrames - 1);
  return [...new Set([0, Math.floor(lastFrame / 2), lastFrame])];
}

async function renderPreviewFrames({ composition, serveUrl, inputProps, outputPrefix, logPrefix }) {
  const frames = previewFramesFor(composition.durationInFrames);
  for (const frame of frames) {
    const output = path.join(VIDEOS_DIR, `${outputPrefix}-preflight-${frame}.png`);
    await renderStill({
      composition,
      serveUrl,
      inputProps,
      frame,
      imageFormat: "png",
      output,
    });
    await fs.promises.rm(output, { force: true }).catch(() => {});
  }
  console.log(`${logPrefix} preview frames OK (${frames.join(", ")})`);
}

function restoreSceneSlot(previousSource) {
  try {
    fs.mkdirSync(path.dirname(SCENE_PATH), { recursive: true });
    if (previousSource == null) {
      fs.rmSync(SCENE_PATH, { force: true });
    } else {
      fs.writeFileSync(SCENE_PATH, previousSource, "utf8");
    }
    console.log("[worker] restored previous Remotion scene after failed render");
  } catch (restoreErr) {
    console.error("[worker] failed to restore previous Remotion scene:", restoreErr);
  }
}

/**
 * Capture as much detail as possible from any thrown value so the API + UI
 * can show the *root cause* instead of "Render failed". Falls back gracefully
 * on non-Error throws.
 */
function describeError(err) {
  if (err instanceof Error) {
    return {
      message: err.message || err.name || "Unknown error",
      code: err.code || err.name || null,
      stack: err.stack || null,
    };
  }
  if (typeof err === "string") return { message: err, code: null, stack: null };
  try {
    return { message: JSON.stringify(err), code: null, stack: null };
  } catch {
    return { message: String(err), code: null, stack: null };
  }
}

/**
 * Run a render phase and re-throw with `phase` attached so the outer
 * try/catch can record exactly where the pipeline broke.
 */
async function runPhase(phase, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err && typeof err === "object") err.phase = phase;
    else {
      const wrapped = new Error(String(err));
      wrapped.phase = phase;
      throw wrapped;
    }
    throw err;
  }
}

async function recordWarning(projectId, phase, message) {
  try {
    await Project.updateOne(
      { _id: projectId },
      {
        $push: {
          warnings: {
            $each: [{ phase, message: String(message).slice(0, 400), at: new Date() }],
            // Keep only the last 10 warnings so docs don't bloat.
            $slice: -10,
          },
        },
      }
    );
  } catch (e) {
    console.error("[worker] failed to record warning:", e);
  }
}

/**
 * On boot, any project still marked RENDERING is an orphan from a worker
 * that died (crash, OOM kill, restart, deploy). The honest read is "we
 * can't tell if the project is broken or the worker just restarted", so
 * we err on the side of the project: requeue WITHOUT counting it as a
 * retry. Only fail an orphan if it had actually made real render progress
 * (progress > 30, meaning renderMedia was producing frames) AND already
 * burned its retries — that's a strong signal the project itself is bad.
 */
async function reclaimOrphans() {
  const orphans = await Project.find({ status: "RENDERING", deletedAt: null }).select(
    "_id renderAttempts userId durationSec progress"
  );
  if (!orphans.length) return;
  console.log(`[worker] reclaiming ${orphans.length} orphan(s) from previous run`);
  for (const o of orphans) {
    const madeRealProgress = (o.progress ?? 0) > 30;
    if (madeRealProgress && (o.renderAttempts ?? 0) >= MAX_AUTO_RETRIES) {
      await Project.updateOne(
        { _id: o._id },
        {
          status: "FAILED",
          progress: 0,
          errorPhase: "render",
          errorCode: "ORPHAN_MAX_RETRIES",
          errorMessage:
            "Render started, made real progress, then crashed twice. Marking failed so it doesn't loop. Click Retry to try again with a fresh attempt counter.",
          errorAt: new Date(),
        }
      );
      await refundCredits(String(o.userId), costForDuration(o.durationSec), String(o._id)).catch(
        () => {}
      );
      console.warn(`[worker] orphan ${o._id} truly exhausted (progress=${o.progress}) → FAILED`);
    } else {
      // Restart-only or progress-less orphan: requeue WITHOUT incrementing
      // attempts. A worker restart isn't the project's fault.
      await Project.updateOne(
        { _id: o._id },
        { status: "QUEUED", progress: 0, renderStartedAt: null, renderHeartbeatAt: null }
      );
      console.log(
        `[worker] orphan ${o._id} re-QUEUED (no attempt charged, progress was ${o.progress ?? 0})`
      );
    }
  }
}

/**
 * Periodic scan for jobs whose worker hasn't reported progress in a while.
 * Either the worker crashed silently, the render genuinely hung, or storage
 * upload is stalled. We requeue (with attempt counter) until the cap.
 */
async function watchdogTick() {
  const cutoff = new Date(Date.now() - STUCK_RENDER_MS);
  const stuck = await Project.find({
    status: "RENDERING",
    deletedAt: null,
    $or: [
      { renderHeartbeatAt: { $lt: cutoff } },
      { renderHeartbeatAt: null, renderStartedAt: { $lt: cutoff } },
    ],
  }).select("_id renderAttempts userId durationSec");

  for (const job of stuck) {
    const attempts = (job.renderAttempts ?? 0) + 1;
    if (attempts > MAX_AUTO_RETRIES) {
      await Project.updateOne(
        { _id: job._id },
        {
          status: "FAILED",
          progress: 0,
          errorPhase: "render",
          errorCode: "RENDER_STUCK",
          errorMessage: `Render exceeded ${Math.round(STUCK_RENDER_MS / 60000)} min with no progress and hit the retry cap.`,
          errorAt: new Date(),
          renderAttempts: attempts,
        }
      );
      await refundCredits(String(job.userId), costForDuration(job.durationSec), String(job._id)).catch(
        () => {}
      );
      console.warn(`[watchdog] ${job._id} stuck → FAILED (no retries left)`);
    } else {
      await Project.updateOne(
        { _id: job._id },
        {
          status: "QUEUED",
          progress: 0,
          renderStartedAt: null,
          renderHeartbeatAt: null,
          renderAttempts: attempts,
        }
      );
      console.warn(`[watchdog] ${job._id} stuck → re-QUEUED (attempt ${attempts})`);
    }
  }
}

export async function startWorker() {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  await connectDB();
  await (await import("./src/lib/providerKeys.js")).loadProviderKeys();
  await (await import("./src/lib/providerModels.js")).loadProviderModels();
  await (await import("./src/lib/providersConfig.js")).loadProvidersConfig();

  console.log("[worker] ensuring headless browser (first run downloads Chrome)…");
  await ensureBrowser();

  // NOTE: with the code-gen architecture each project has a DIFFERENT
  // component, so we bundle per-render (after writing the component) rather
  // than once at startup.

  await reclaimOrphans();

  // Background watchdog. setInterval is fine — each tick awaits its own work
  // and they don't overlap meaningfully because each tick is short.
  setInterval(() => {
    watchdogTick().catch((err) => console.error("[watchdog] tick error:", err));
  }, WATCHDOG_INTERVAL_MS);

  console.log("[worker] polling for QUEUED projects…");

  // Single-concurrency poll loop. Claim is atomic via findOneAndUpdate.
  for (;;) {
    let job = null;
    try {
      const now = new Date();
      job = await Project.findOneAndUpdate(
        { status: "QUEUED", deletedAt: null },
        {
          status: "RENDERING",
          progress: 5,
          renderStartedAt: now,
          renderHeartbeatAt: now,
          $inc: { renderAttempts: 1 },
          errorPhase: null,
          errorCode: null,
          errorMessage: null,
          errorStack: null,
        },
        { sort: { createdAt: 1 }, new: true }
      );
    } catch (err) {
      console.error("[worker] claim error:", err);
    }

    if (!job) {
      await sleep(POLL_MS);
      continue;
    }

    await renderProject(job);
  }
}

const DIMENSIONS = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:3": [1440, 1080],
};

function preferredHybridProvider() {
  const forced =
    process.env.HYBRID_VIDEO_PROVIDER ||
    process.env.GENERATION_VIDEO_PROVIDER ||
    process.env.GENERATION_PROVIDER_TEXT_TO_VIDEO ||
    "";
  if (forced.trim()) return forced.trim().toLowerCase();

  const videoProviders = providersFor("text_to_video");
  if (videoProviders.includes("kie")) return "kie";
  return undefined;
}

async function renderHybridProject(project) {
  const id = String(project._id);
  const aspect = project.aspectRatio || "16:9";
  const outPath = path.join(VIDEOS_DIR, `${id}.mp4`);
  let lastPhase = "plan-scenes";

  try {
    await Project.updateOne(
      { _id: id },
      {
        progress: 8,
        renderHeartbeatAt: new Date(),
        errorPhase: null,
        errorCode: null,
        errorMessage: null,
        errorStack: null,
      }
    );

    let scenePlan = project.renderPlan?.scenePlan || null;
    let videoPlan = project.renderPlan?.videoPlan || null;

    if (!scenePlan) {
      lastPhase = "plan-scenes";
      scenePlan = await planScenes(
        `${project.prompt}\n\nTarget duration: ${project.durationSec}s. Target aspect ratio: ${aspect}.`
      );
      await Project.updateOne(
        { _id: id },
        {
          progress: 18,
          renderHeartbeatAt: new Date(),
          renderPlan: { scenePlan },
        }
      );
    }

    if (!videoPlan) {
      lastPhase = "generate-footage";
      let completedScenes = 0;
      const totalScenes = Math.max(1, scenePlan.scenes?.length || 1);
      const provider = preferredHybridProvider();
      videoPlan = await buildVideoPlan(scenePlan, {
        provider,
        aspectRatio: aspect,
        jobId: id,
        onProgress: () => {
          completedScenes += 1;
          const pct = Math.min(68, 24 + Math.round((completedScenes / totalScenes) * 40));
          Project.updateOne(
            { _id: id },
            {
              progress: pct,
              renderHeartbeatAt: new Date(),
            }
          ).catch(() => {});
        },
      });
      await Project.updateOne(
        { _id: id },
        {
          progress: 70,
          renderHeartbeatAt: new Date(),
          renderPlan: { scenePlan, videoPlan },
        }
      );
    }

    const inputProps = { aspectRatio: aspect, plan: videoPlan };

    lastPhase = "bundle";
    const serveUrl = await bundle({ entryPoint: ENTRY, webpackOverride });
    lastPhase = "select-composition";
    const composition = await selectComposition({ serveUrl, id: "scene", inputProps });
    lastPhase = "preflight";
    await renderPreviewFrames({
      composition,
      serveUrl,
      inputProps,
      outputPrefix: id,
      logPrefix: `[worker] ${id}`,
    });

    lastPhase = "render";
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outPath,
      inputProps,
      onProgress: ({ progress }) => {
        const pct = Math.min(99, Math.round(72 + progress * 25));
        Project.updateOne(
          { _id: id },
          { progress: pct, renderHeartbeatAt: new Date() }
        ).catch(() => {});
      },
    });

    let outputUrl = `${PUBLIC_BASE}/videos/${id}.mp4`;
    if (isStorageConfigured()) {
      lastPhase = "upload";
      outputUrl = await uploadFile(outPath, `videos/${id}.mp4`, "video/mp4");
      await fs.promises.rm(outPath, { force: true }).catch(() => {});
      console.log(`[worker] uploaded ${id} -> ${outputUrl}`);
    }

    lastPhase = "finalize";
    await Project.updateOne(
      { _id: id },
      {
        status: "DONE",
        progress: 100,
        outputUrl,
        sceneJson: null,
        componentSource: null,
        errorMessage: null,
        errorPhase: null,
        errorCode: null,
        errorStack: null,
        errorAt: null,
        renderHeartbeatAt: new Date(),
      }
    );

    console.log(`[worker] hybrid done ${id}`);
  } catch (err) {
    const desc = describeError(err);
    const phase = err?.phase || lastPhase || "render";
    console.error(`[worker] hybrid ${id} failed in phase=${phase} code=${desc.code}:`, desc.message);
    if (desc.stack) console.error(desc.stack);

    await Project.updateOne(
      { _id: id },
      {
        status: "FAILED",
        progress: 0,
        errorMessage: desc.message,
        errorCode: desc.code,
        errorStack: desc.stack,
        errorPhase: phase,
        errorAt: new Date(),
        outputUrl: null,
      }
    );
    await refundCredits(String(project.userId), costForDuration(project.durationSec), id).catch(
      (refundErr) => console.error(`[worker] refund failed for ${id}:`, refundErr)
    );
  }
}

async function renderProject(project) {
  const id = String(project._id);
  console.log(
    `[worker] rendering ${id} (${project.aspectRatio}, ${project.durationSec}s, attempt ${project.renderAttempts})…`
  );

  if (!project.componentSource?.trim()) {
    await renderHybridProject(project);
    return;
  }

  let lastPhase = "load-plan";
  let previousSceneSource = null;
  let sceneSlotTouched = false;
  try {
    if (!project.componentSource || !project.componentSource.trim()) {
      throw new Error("Project has no generated component to render");
    }

    const aspect = project.aspectRatio || "16:9";
    const durationInFrames = Math.max(1, Math.round((Number(project.durationSec) || 20) * FPS));
    const inputProps = { aspectRatio: aspect, durationInFrames };
    const outPath = path.join(VIDEOS_DIR, `${id}.mp4`);
    previousSceneSource = fs.existsSync(SCENE_PATH)
      ? fs.readFileSync(SCENE_PATH, "utf8")
      : null;

    // Write → bundle → render, with up to 2 self-repair attempts if the
    // component crashes at bundle/render time. The repaired source is saved
    // back to the project so future re-renders use the working version.
    let current = project.componentSource;
    const MAX_RENDER_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_RENDER_ATTEMPTS; attempt++) {
      fs.mkdirSync(path.dirname(SCENE_PATH), { recursive: true });
      fs.writeFileSync(SCENE_PATH, current, "utf8");
      sceneSlotTouched = true;

      try {
        lastPhase = "bundle";
        const serveUrl = await bundle({ entryPoint: ENTRY, webpackOverride });
        lastPhase = "select-composition";
        const composition = await selectComposition({ serveUrl, id: "video", inputProps });
        lastPhase = "preflight";
        await renderPreviewFrames({
          composition,
          serveUrl,
          inputProps,
          outputPrefix: id,
          logPrefix: `[worker] ${id}`,
        });
        lastPhase = "render";
        await renderMedia({
          composition,
          serveUrl,
          codec: "h264",
          outputLocation: outPath,
          inputProps,
          onProgress: ({ progress }) => {
            const pct = Math.min(99, Math.round(5 + progress * 90));
            Project.updateOne(
              { _id: id },
              { progress: pct, renderHeartbeatAt: new Date() }
            ).catch(() => {});
          },
        });
        if (current !== project.componentSource) {
          await Project.updateOne({ _id: id }, { componentSource: current }).catch(() => {});
        }
        break; // render succeeded
      } catch (renderErr) {
        const msg = renderErr instanceof Error ? renderErr.message : String(renderErr);
        console.warn(`[worker] ${id} render attempt ${attempt} failed: ${msg.slice(0, 160)}`);
        if (attempt === MAX_RENDER_ATTEMPTS) throw renderErr;
        console.log(`[worker] ${id} repairing component…`);
        current = await fixComponent({ brokenSource: current, error: msg });
      }
    }

    let outputUrl = `${PUBLIC_BASE}/videos/${id}.mp4`;
    if (isStorageConfigured()) {
      outputUrl = await runPhase("upload", async () => {
        lastPhase = "upload";
        const url = await uploadFile(outPath, `videos/${id}.mp4`, "video/mp4");
        await fs.promises.rm(outPath, { force: true }).catch(() => {});
        return url;
      });
      console.log(`[worker] uploaded ${id} → ${outputUrl}`);
    }

    await runPhase("finalize", async () => {
      lastPhase = "finalize";
      await Project.updateOne(
        { _id: id },
        {
          status: "DONE",
          progress: 100,
          outputUrl,
          errorMessage: null,
          errorPhase: null,
          errorCode: null,
          errorStack: null,
          errorAt: null,
          renderHeartbeatAt: new Date(),
        }
      );
    });

    console.log(`[worker] ✓ done ${id}`);
  } catch (err) {
    if (sceneSlotTouched) restoreSceneSlot(previousSceneSource);

    const desc = describeError(err);
    const phase = err?.phase || lastPhase || "render";
    console.error(`[worker] ✗ ${id} failed in phase=${phase} code=${desc.code} :`, desc.message);
    if (desc.stack) console.error(desc.stack);

    await Project.updateOne(
      { _id: id },
      {
        status: "FAILED",
        progress: 0,
        errorMessage: desc.message,
        errorCode: desc.code,
        errorStack: desc.stack,
        errorPhase: phase,
        errorAt: new Date(),
        outputUrl: null,
      }
    );
    await refundCredits(String(project.userId), costForDuration(project.durationSec), id).catch(
      (refundErr) => console.error(`[worker] refund failed for ${id}:`, refundErr)
    );
  }
}

// Public — pipeline.js / TTS code can call this to attach non-fatal warnings.
export { recordWarning };

// Only auto-run when launched directly (`npm run worker`). When imported by
// the backend (INLINE_WORKER mode) the server calls startWorker() itself.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  startWorker().catch((err) => {
    console.error("[worker] fatal:", err);
    process.exit(1);
  });
}
