import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { connectDB } from "./src/db.js";
import { Project } from "./src/models.js";
import { costForDuration, refundCredits } from "./src/lib/credits.js";
import { attachLottieAssetsToPlan } from "./src/lib/lottieLibrary.js";
import { writeGeneratedCode } from "./src/lib/pipeline.js";
import { isStorageConfigured, uploadFile } from "./src/lib/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = path.join(__dirname, "public", "videos");
const ENTRY = path.join(__dirname, "remotion", "index.jsx");
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

  console.log("[worker] ensuring headless browser (first run downloads Chrome)…");
  await ensureBrowser();

  console.log("[worker] bundling Remotion compositions…");
  const serveUrl = await bundle({ entryPoint: ENTRY });
  console.log("[worker] bundle ready.");

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

    await renderProject(serveUrl, job);
  }
}

async function renderProject(serveUrl, project) {
  const id = String(project._id);
  const hasGeneratedCode = !!project.generatedCode;
  console.log(
    `[worker] rendering ${id} (${project.aspectRatio}, ${project.durationSec}s, attempt ${project.renderAttempts}, codegen=${hasGeneratedCode})…`
  );

  let lastPhase = "load-plan";
  try {
    await runPhase("load-plan", async () => {
      lastPhase = "load-plan";
      if (!project.sceneJson && !project.generatedCode) {
        throw new Error("Project has no scene plan or generated code to render");
      }
    });

    // Decide render path: code-gen (AI wrote JSX) or JSON-driven (legacy).
    let activeServeUrl = serveUrl;
    let compositionId = "video";
    let inputProps = null;

    if (hasGeneratedCode) {
      // CODE-GEN PATH: write the AI code to disk and re-bundle so Remotion
      // picks up the new Current.jsx. This adds ~15-20s but produces
      // custom animations that no pre-built template can match.
      let codeGenOk = false;
      try {
        await runPhase("write-codegen", async () => {
          lastPhase = "write-codegen";
          // Validate the generated code isn't truncated/broken before writing
          const code = project.generatedCode;
          if (!code || code.length < 100) throw new Error("Generated code too short");
          if (!code.includes("export default")) throw new Error("Generated code missing default export");
          // Check balanced braces as a quick syntax sanity check
          const opens = (code.match(/\{/g) || []).length;
          const closes = (code.match(/\}/g) || []).length;
          if (Math.abs(opens - closes) > 2) throw new Error(`Unbalanced braces: ${opens} open vs ${closes} close — code likely truncated`);
          writeGeneratedCode(code);
          console.log(`[worker] wrote generated code for ${id} (${code.length} chars)`);
        });

        await runPhase("bundle-codegen", async () => {
          lastPhase = "bundle-codegen";
          activeServeUrl = await bundle({ entryPoint: ENTRY });
          console.log(`[worker] re-bundled for code-gen ${id}`);
        });

        compositionId = "generated";
        inputProps = {
          duration: project.durationSec || 20,
          aspectRatio: project.aspectRatio || "16:9",
        };
        codeGenOk = true;
      } catch (codeErr) {
        const msg = codeErr instanceof Error ? codeErr.message : String(codeErr);
        console.warn(`[worker] code-gen render failed for ${id}, falling back to JSON plan: ${msg}`);
        await recordWarning(id, "bundle-codegen", `Code-gen failed, using JSON fallback: ${msg}`);
        // Fall through to JSON path below
      }

      if (!codeGenOk && project.sceneJson) {
        // Fallback to JSON-driven render
        inputProps = await runPhase("attach-lottie", async () => {
          lastPhase = "attach-lottie";
          return await attachLottieAssetsToPlan(project.sceneJson);
        });
      } else if (!codeGenOk) {
        throw new Error("Code-gen failed and no JSON plan available as fallback");
      }
    } else {
      // JSON PATH: use the pre-bundled serve URL.
      inputProps = await runPhase("attach-lottie", async () => {
        lastPhase = "attach-lottie";
        return await attachLottieAssetsToPlan(project.sceneJson);
      });
    }

    const composition = await runPhase("select-composition", async () => {
      lastPhase = "select-composition";
      return await selectComposition({
        serveUrl: activeServeUrl,
        id: compositionId,
        inputProps,
      });
    });

    const outPath = path.join(VIDEOS_DIR, `${id}.mp4`);

    await runPhase("render", async () => {
      lastPhase = "render";
      await renderMedia({
        composition,
        serveUrl: activeServeUrl,
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
    });

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
