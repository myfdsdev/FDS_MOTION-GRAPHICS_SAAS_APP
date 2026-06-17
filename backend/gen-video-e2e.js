// End-to-end test: generate assets + compose a video.
// Usage: npm run (this is registered below)
// Uses mock providers (GENERATION_MOCK=1), so no real API keys needed.

import "dotenv/config";
import { runGenerationJob } from "./src/lib/generation/job.js";

async function main() {
  console.log("[e2e] Starting end-to-end generation + composition test…");
  console.log("[e2e] Using mock providers (no real API calls).\n");

  const brief = {
    videoType: "hybrid",
    script: "Welcome to our product. Let's make great videos together.",
    musicMood: "uplifting corporate, 30 seconds",
    durationSec: 30,
    shots: [
      {
        prompt: "sleek corporate office with modern desks, cinematic lighting",
        durationSec: 5,
      },
      {
        prompt: "close-up of hands typing on keyboard, blue light, tech vibe",
        durationSec: 4,
      },
      {
        prompt: "wide shot of team collaborating, vibrant colors, motion blur",
        durationSec: 5,
      },
    ],
  };

  const result = await runGenerationJob({
    projectId: "test_e2e_001",
    userId: "test_user",
    brief,
    onProgress: (e) => {
      const { phase, stage, progress } = e;
      const pct = progress ? ` ${Math.round(progress * 100)}%` : "";
      console.log(`[${phase}] ${stage}${pct}`);
    },
  });

  console.log("\n[e2e] Result:");
  console.log(JSON.stringify(result, null, 2));

  if (result.ok) {
    console.log(`\n✅ Success! Video: ${result.outputUrl} (${result.durationSec}s)`);
    process.exit(0);
  } else {
    console.log(`\n❌ Failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[e2e] Uncaught:", err);
  process.exit(1);
});
