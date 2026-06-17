// System TTS provider — REAL voice synthesis using the OS speech engine, with
// NO API and NO cost. On Windows this is SAPI (System.Speech) via PowerShell,
// which ships with every Win10/11 box (voices: David, Zira). This guarantees a
// real narration track even with zero paid API keys — the honest fallback when
// ElevenLabs free tier (402) or fal/kie (no key) aren't available.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { CAPABILITY } from "../capabilities.js";

const OUT_DIR = path.resolve("public", "tts");
const results = new Map();

function q(s) {
  return String(s).replace(/'/g, "''"); // escape single quotes for PowerShell
}

function synthWindows({ text, wavPath, voice, rate }) {
  // Write the script text to a temp file so we never fight PowerShell quoting.
  const txt = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`);
  fs.writeFileSync(txt, String(text || ""), "utf8");
  const cmd = [
    "Add-Type -AssemblyName System.Speech;",
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;",
    voice ? `try { $s.SelectVoice('${q(voice)}') } catch {};` : "",
    rate != null ? `$s.Rate = ${parseInt(rate, 10) || 0};` : "",
    `$s.SetOutputToWaveFile('${q(wavPath)}');`,
    `$s.Speak([IO.File]::ReadAllText('${q(txt)}'));`,
    "$s.Dispose();",
  ].filter(Boolean).join(" ");

  return new Promise((resolve, reject) => {
    const p = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd]);
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => {
      fs.rmSync(txt, { force: true });
      if (code === 0 && fs.existsSync(wavPath)) resolve();
      else reject(new Error(`system TTS (SAPI) failed (${code}): ${err.slice(-200)}`));
    });
  });
}

export const systemProvider = {
  name: "system",
  supports: new Set([CAPABILITY.TEXT_TO_SPEECH]),

  available() {
    return process.platform === "win32"; // SAPI is always present on Windows
  },

  async submit(_capability, params = {}) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const id = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const wav = path.join(OUT_DIR, `${id}.wav`);
    if (process.platform !== "win32") {
      throw new Error("system TTS currently implemented for Windows (SAPI) only");
    }
    await synthWindows({ text: params.text, wavPath: wav, voice: params.voice, rate: params.rate });
    const { size } = fs.statSync(wav);
    results.set(id, { kind: "audio", url: `/tts/${id}.wav`, path: wav, mimeType: "audio/wav", bytes: size });
    return { jobId: id };
  },

  async poll(jobId) {
    const r = results.get(jobId);
    if (!r) return { status: "failed", error: `unknown system tts job: ${jobId}` };
    results.delete(jobId);
    return { status: "done", assets: [r] };
  },
};
