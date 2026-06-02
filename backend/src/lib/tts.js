import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { localTtsScriptPath, runPiperToFile } from "./localTts.js";

export function isTtsConfigured() {
  return fs.existsSync(localTtsScriptPath());
}

/**
 * Synthesize narration using the local Piper model.
 *
 * Returns an audio payload rather than provider-specific details so the
 * pipeline can save it and Remotion can mux it into the final MP4.
 */
export async function synthesizeVoiceover(text) {
  const cleanText = String(text || "").trim();
  if (!cleanText) throw new Error("Voiceover script is empty");
  if (!isTtsConfigured()) throw new Error(`Piper script not found: ${localTtsScriptPath()}`);

  const tempPath = path.join(os.tmpdir(), `remotion-piper-${crypto.randomUUID()}.wav`);

  try {
    const generated = await runPiperToFile({ text: cleanText, outputPath: tempPath });
    const buffer = await fs.promises.readFile(tempPath);

    return {
      buffer,
      extension: "wav",
      contentType: "audio/wav",
      size: generated.size,
    };
  } finally {
    await fs.promises.rm(tempPath, { force: true }).catch(() => {});
  }
}

/**
 * Rough duration estimate from raw text, around 160 words per minute.
 * The editor lets the user drag/trim the generated narration if needed.
 */
export function estimateVoiceoverDuration(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  return Math.max(1, Math.round((words * 60) / 160));
}
