// Mock generation provider — lets the whole engine run offline, with no API
// key and no network. It simulates the submit → poll → complete lifecycle (a
// couple of "running" polls, then a deterministic fake asset) so the engine,
// cost gating, worker integration, and tests can all be exercised before any
// real fal.ai key exists. Enabled only when GENERATION_MOCK=1 or no real
// provider is available.

import { CAPABILITY, CAPABILITY_OUTPUT } from "../capabilities.js";

const POLLS_UNTIL_DONE = 2;
const jobs = new Map();

// A tiny deterministic placeholder per output kind (so downstream compose code
// has a real, local file/URL shape to handle).
function fakeAsset(capability, params) {
  const kind = CAPABILITY_OUTPUT[capability];
  if (kind === "image") {
    return { kind: "image", url: "mock://image.png", mimeType: "image/png", width: 1024, height: 1024 };
  }
  if (kind === "video") {
    return {
      kind: "video",
      url: "mock://clip.mp4",
      mimeType: "video/mp4",
      durationSec: params.durationSec || 5,
      width: 1920,
      height: 1080,
    };
  }
  if (kind === "audio") {
    return {
      kind: "audio",
      url: "mock://audio.mp3",
      mimeType: "audio/mpeg",
      durationSec: params.durationSec || 8,
    };
  }
  // transcribe → data
  return {
    kind: "data",
    data: { words: [{ word: "mock", startMs: 0, endMs: 400 }] },
  };
}

export const mockProvider = {
  name: "mock",
  supports: new Set(Object.values(CAPABILITY)),

  available() {
    return process.env.GENERATION_MOCK === "1" || process.env.GENERATION_MOCK === "true";
  },

  async submit(capability, params = {}) {
    const jobId = `mock_${Math.random().toString(36).slice(2, 10)}`;
    jobs.set(jobId, { capability, params, polls: 0 });
    return { jobId };
  },

  async poll(jobId) {
    const job = jobs.get(jobId);
    if (!job) return { status: "failed", error: `Unknown mock job: ${jobId}` };
    job.polls += 1;
    if (job.polls < POLLS_UNTIL_DONE) {
      return { status: "running", progress: job.polls / POLLS_UNTIL_DONE };
    }
    jobs.delete(jobId);
    return { status: "done", assets: [fakeAsset(job.capability, job.params)] };
  },
};
