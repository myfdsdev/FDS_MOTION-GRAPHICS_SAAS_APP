// REAL end-to-end: actual ElevenLabs TTS + actual ffmpeg compose. No mocks.
// Produces a real, playable MP4 with AI narration over the motion-graphics clip.
//
//   node gen-real-e2e.js

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { runGeneration, CAPABILITY, providersFor } from "./src/lib/generation/index.js";
import { composeVideo } from "./src/lib/generation/compose.js";

const SCRIPT =
  "Re-Motion turns a single prompt into a finished video. Generated entirely by AI.";

async function main() {
  console.log("[real-e2e] TTS providers available:", providersFor(CAPABILITY.TEXT_TO_SPEECH));

  // 1. REAL text-to-speech
  console.log("[real-e2e] generating narration via ElevenLabs…");
  const tts = await runGeneration({
    capability: CAPABILITY.TEXT_TO_SPEECH,
    params: { text: SCRIPT },
    onProgress: (e) => console.log(`  tts: ${e.stage}`),
  });
  if (!tts.ok) throw new Error(`TTS failed: ${tts.error}`);
  const audio = tts.assets[0];
  console.log(`[real-e2e] ✅ real audio: ${audio.path} (${(audio.bytes / 1024).toFixed(1)} KB) via ${tts.provider}`);

  // 2. REAL compose: narration over the motion-graphics clip we rendered earlier
  const baseVisual = path.resolve("public/videos/demo-motion.mp4");
  const haveVisual = fs.existsSync(baseVisual);
  console.log(`[real-e2e] base visual: ${haveVisual ? baseVisual : "(none — will use solid background)"}`);

  const outputPath = path.resolve("public/videos/real-narrated.mp4");
  console.log("[real-e2e] composing with ffmpeg…");
  const comp = await composeVideo({
    recipe: "hybrid",
    assets: { narration: audio, baseVisual: haveVisual ? baseVisual : undefined, durationSec: 8 },
    outputPath,
    onProgress: (e) => console.log(`  compose: ${e.stage}`),
  });
  if (!comp.ok) throw new Error(`Compose failed: ${comp.error}`);

  const stat = fs.statSync(outputPath);
  console.log(`\n[real-e2e] ✅ REAL MP4 written: ${outputPath}`);
  console.log(`[real-e2e]    ${(stat.size / 1024).toFixed(1)} KB on disk`);
}

main().catch((err) => {
  console.error("\n[real-e2e] ❌", err.message);
  process.exit(1);
});
