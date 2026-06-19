// Caption generation — produce word-level subtitles that sync to the narration.
//
// We already KNOW the exact spoken text (the planner's narration.script), so we
// don't need speech-to-text to get the words — only their TIMING. This module
// measures the synthesized narration's real duration with ffprobe and spreads
// the known words across it, weighted by word length + punctuation pauses. That
// gives karaoke-style captions on EVERY video, free and instantly, with no ASR.
//
// Accuracy upgrade path (later): swap `estimateWordTimings` for a Whisper /
// forced-alignment pass on the audio for frame-perfect timing. The output shape
// ({ words:[{word,startMs,endMs}], wordsPerPage }) already matches what the
// SceneRenderer's CaptionOverlay consumes, so nothing downstream changes.

import { spawn } from "node:child_process";
import path from "node:path";
import { findFfmpeg } from "./compose.js";

/** ffprobe lives next to the bundled ffmpeg; derive its path from findFfmpeg(). */
function findFfprobe() {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  const ff = findFfmpeg();
  if (ff && ff !== "ffmpeg") {
    const probe = ff.replace(/ffmpeg(\.exe)?$/i, (_m, ext) => `ffprobe${ext || ""}`);
    if (probe !== ff) return probe;
  }
  return "ffprobe";
}

/** Read media duration in seconds (works on a local path OR an http URL). 0 on failure. */
function probeDurationSeconds(src) {
  return new Promise((resolve) => {
    const bin = findFfprobe();
    const args = [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      String(src),
    ];
    let out = "";
    let proc;
    try {
      proc = spawn(bin, args);
    } catch {
      return resolve(0);
    }
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", () => resolve(0));
    proc.on("close", () => {
      const n = parseFloat(out.trim());
      resolve(Number.isFinite(n) && n > 0 ? n : 0);
    });
  });
}

/**
 * Spread the script's words across `durationSeconds`, weighting longer words
 * and punctuation (a comma/period implies a pause) so timing tracks speech
 * pacing better than an even split.
 *
 * @returns {Array<{word:string,startMs:number,endMs:number}>}
 */
export function estimateWordTimings(script, durationSeconds) {
  const tokens = String(script || "").trim().split(/\s+/).filter(Boolean);
  const durMs = Math.max(0, durationSeconds * 1000);
  if (!tokens.length || !durMs) return [];

  const weights = tokens.map((t) => {
    const letters = t.replace(/[^A-Za-z0-9]/g, "").length;
    let w = Math.max(1, letters) + 1; // base time per word
    if (/[,;:)]$/.test(t)) w += 2; // short pause
    if (/[.!?…]$/.test(t)) w += 4; // sentence pause
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;

  let cursor = 0;
  return tokens.map((word, i) => {
    const span = (durMs * weights[i]) / total;
    const startMs = Math.round(cursor);
    cursor += span;
    return { word, startMs, endMs: Math.round(cursor) };
  });
}

/**
 * Build a captions object for the video from the narration script + its audio.
 *
 * @param {object} o
 * @param {string} o.script            the spoken narration text
 * @param {string} [o.audioSrc]        narration audio (local path or http url) to measure
 * @param {number} [o.fallbackSeconds] used if the audio can't be probed (e.g. sum of scene durations)
 * @param {number} [o.wordsPerPage]    words shown per caption page (default 5)
 * @returns {Promise<{ words: Array, wordsPerPage: number } | null>}
 */
export async function generateCaptions({ script, audioSrc, fallbackSeconds = 0, wordsPerPage = 5 }) {
  const text = String(script || "").trim();
  if (!text) return null;

  let duration = 0;
  if (audioSrc) duration = await probeDurationSeconds(audioSrc).catch(() => 0);
  if (!duration) duration = fallbackSeconds;
  if (!duration) return null;

  const words = estimateWordTimings(text, duration);
  if (!words.length) return null;

  return { words, wordsPerPage };
}

export { probeDurationSeconds };
