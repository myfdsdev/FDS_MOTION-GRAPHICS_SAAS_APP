// Compose layer — assemble generated assets into a REAL finished MP4 using
// ffmpeg. No mocks: these functions spawn ffmpeg and write actual video files.
//
// Strategies:
//   - muxAudioOverVideo: lay narration/music over a visual track (hybrid videos)
//   - concatClips:       join multiple AI clips end-to-end (pure-AI videos)
//   - solidBgVideo:      generate a colored background track (fallback visual)
//
// ffmpeg binary: Remotion ships one in node_modules/@remotion/compositor-*,
// so we reuse it (no separate ffmpeg install). Override with FFMPEG_PATH.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

/** Locate an ffmpeg binary: env override → Remotion's bundled one → PATH. */
export function findFfmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const remotionDir = path.resolve("node_modules", "@remotion");
  try {
    for (const d of fs.readdirSync(remotionDir)) {
      if (d.startsWith("compositor-")) {
        const exe = path.join(remotionDir, d, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
        if (fs.existsSync(exe)) return exe;
      }
    }
  } catch {
    /* fall through */
  }
  return "ffmpeg";
}

function runFfmpeg(args) {
  const bin = findFfmpeg();
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/** Resolve an asset (engine result or path/url) to a local file path. */
function localPathOf(asset) {
  if (!asset) return null;
  if (typeof asset === "string") return asset;
  if (asset.path && fs.existsSync(asset.path)) return asset.path;
  if (asset.url && asset.url.startsWith("/")) {
    const p = path.resolve("public", asset.url.replace(/^\//, ""));
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** ffprobe-free duration read via ffmpeg is awkward; estimate elsewhere. */
async function ffmpegExists(file) {
  return Boolean(file && fs.existsSync(file));
}

/**
 * Mux an audio track over a video track into a real MP4. The video loops to
 * cover the audio and is cut when the audio ends (-shortest). Re-encodes so the
 * output is a clean, seekable H.264/AAC file.
 */
export async function muxAudioOverVideo({ videoPath, audioPath, outputPath }) {
  if (!(await ffmpegExists(videoPath))) throw new Error(`compose: video not found: ${videoPath}`);
  if (!(await ffmpegExists(audioPath))) throw new Error(`compose: audio not found: ${audioPath}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await runFfmpeg([
    "-y",
    "-stream_loop", "-1", "-i", videoPath,
    "-i", audioPath,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-shortest",
    outputPath,
  ]);
  return outputPath;
}

/** Generate a solid-color background video of a given duration (fallback visual). */
export async function solidBgVideo({ color = "#0A0A0F", width = 1920, height = 1080, durationSec = 8, outputPath }) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const hex = color.replace("#", "0x");
  await runFfmpeg([
    "-y",
    "-f", "lavfi",
    "-i", `color=c=${hex}:s=${width}x${height}:d=${durationSec}:r=30`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    outputPath,
  ]);
  return outputPath;
}

/** Concatenate multiple video clips into one MP4 (re-encode for safety). */
export async function concatClips({ clipPaths = [], outputPath }) {
  const valid = clipPaths.filter((p) => fs.existsSync(p));
  if (!valid.length) throw new Error("compose: no valid clips to concat");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  // filter_complex concat handles differing codecs/sizes safely.
  const inputs = valid.flatMap((p) => ["-i", p]);
  const n = valid.length;
  const streams = valid.map((_, i) => `[${i}:v:0]`).join("");
  await runFfmpeg([
    "-y",
    ...inputs,
    "-filter_complex", `${streams}concat=n=${n}:v=1:a=0[outv]`,
    "-map", "[outv]",
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    outputPath,
  ]);
  return outputPath;
}

/**
 * Top-level recipe dispatcher. Returns { ok, outputPath } and ACTUALLY writes a
 * file (or { ok:false, error }).
 */
export async function composeVideo({ recipe, assets = {}, outputPath, onProgress = () => {} }) {
  try {
    const audioPath = localPathOf(assets.narration) || localPathOf(assets.music);
    let visualPath = localPathOf(assets.baseVisual);

    // No real visual available (e.g. no AI clips) → make a solid-color one.
    if (!visualPath && assets.videoClips?.length) {
      const clipPaths = assets.videoClips.map(localPathOf).filter(Boolean);
      if (clipPaths.length) {
        onProgress({ stage: "concat", progress: 0.3 });
        visualPath = await concatClips({ clipPaths, outputPath: outputPath.replace(/\.mp4$/, ".visual.mp4") });
      }
    }
    if (!visualPath) {
      onProgress({ stage: "background", progress: 0.3 });
      visualPath = await solidBgVideo({
        durationSec: assets.durationSec || 8,
        outputPath: outputPath.replace(/\.mp4$/, ".bg.mp4"),
      });
    }

    if (audioPath) {
      onProgress({ stage: "audio_mux", progress: 0.7 });
      await muxAudioOverVideo({ videoPath: visualPath, audioPath, outputPath });
    } else {
      fs.copyFileSync(visualPath, outputPath);
    }

    onProgress({ stage: "done", progress: 1 });
    return { ok: true, outputPath };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}
