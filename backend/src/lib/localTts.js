import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
export const TTS_OUTPUT_DIR = path.join(PUBLIC_DIR, "tts");

const DEFAULT_PIPER_SCRIPT =
  "C:\\Users\\User\\Desktop\\TTS LOCAL MODEL\\piper\\run_tts.ps1";

function safeUserFolder(userId) {
  return String(userId || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

export function localTtsScriptPath() {
  return process.env.PIPER_TTS_SCRIPT || DEFAULT_PIPER_SCRIPT;
}

export async function runPiperToFile({ text, outputPath }) {
  const scriptPath = localTtsScriptPath();
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Piper script not found: ${scriptPath}`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-Text",
      text,
      "-OutputFile",
      outputPath,
    ],
    {
      timeout: Number(process.env.PIPER_TTS_TIMEOUT_MS) || 120000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }
  );

  const stat = await fs.promises.stat(outputPath);
  if (!stat.isFile() || stat.size < 44) {
    throw new Error("Piper did not create a valid WAV file");
  }

  return { localPath: outputPath, size: stat.size };
}

export async function generatePiperWav({ text, userId }) {
  const userFolder = safeUserFolder(userId);
  const fileName = `${Date.now()}-${crypto.randomUUID()}.wav`;
  const outputDir = path.join(TTS_OUTPUT_DIR, userFolder);
  const outputPath = path.join(outputDir, fileName);

  const generated = await runPiperToFile({ text, outputPath });

  return {
    fileName,
    localPath: outputPath,
    relativeUrl: `/tts/${encodeURIComponent(userFolder)}/${encodeURIComponent(fileName)}`,
    size: generated.size,
  };
}
