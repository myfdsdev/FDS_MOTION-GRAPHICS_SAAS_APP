// fal.ai provider — one key, many models. fal exposes a uniform QUEUE API:
//   POST https://queue.fal.run/<model>           -> { request_id, status_url, response_url }
//   GET  <status_url>   -> { status: IN_QUEUE | IN_PROGRESS | COMPLETED }
//   GET  <response_url> -> model-specific output payload
//
// We map each engine capability to a fal model slug + an input builder + an
// output normalizer. Model slugs evolve on fal's side, so they're overridable
// via env (FAL_MODEL_<CAPABILITY>) — update the defaults against fal.ai/models
// without touching engine code. Auth header is `Authorization: Key <FAL_KEY>`.

import { CAPABILITY, CAPABILITY_OUTPUT } from "../capabilities.js";
import { getProviderKey } from "../../providerKeys.js";

const QUEUE_BASE = "https://queue.fal.run";

// Default model slugs. Verify/override against current fal.ai catalog.
const DEFAULT_MODELS = {
  [CAPABILITY.TEXT_TO_IMAGE]: "fal-ai/flux/dev",
  [CAPABILITY.IMAGE_TO_VIDEO]: "fal-ai/kling-video/v1/standard/image-to-video",
  [CAPABILITY.TEXT_TO_VIDEO]: "fal-ai/kling-video/v1/standard/text-to-video",
  [CAPABILITY.TEXT_TO_SPEECH]: "fal-ai/elevenlabs/tts/multilingual-v2",
  [CAPABILITY.MUSIC]: "fal-ai/elevenlabs/music",
  [CAPABILITY.TRANSCRIBE]: "fal-ai/whisper",
};

function modelFor(capability) {
  const envKey = `FAL_MODEL_${capability.toUpperCase()}`;
  return process.env[envKey] || DEFAULT_MODELS[capability];
}

function key() {
  return getProviderKey("fal");
}

function authHeaders() {
  return { Authorization: `Key ${key()}`, "Content-Type": "application/json" };
}

// ---- our normalized params -> fal model input ----------------------------
function buildInput(capability, p = {}) {
  switch (capability) {
    case CAPABILITY.TEXT_TO_IMAGE:
      return {
        prompt: p.prompt,
        image_size: p.imageSize || "landscape_16_9",
        num_images: p.numImages || 1,
        ...(p.seed != null ? { seed: p.seed } : {}),
      };
    case CAPABILITY.IMAGE_TO_VIDEO:
      return {
        prompt: p.prompt || "",
        image_url: p.imageUrl,
        duration: String(p.durationSec || 5),
        ...(p.aspectRatio ? { aspect_ratio: p.aspectRatio } : {}),
      };
    case CAPABILITY.TEXT_TO_VIDEO:
      return {
        prompt: p.prompt,
        duration: String(p.durationSec || 5),
        ...(p.aspectRatio ? { aspect_ratio: p.aspectRatio } : {}),
      };
    case CAPABILITY.TEXT_TO_SPEECH:
      return {
        text: p.text,
        ...(p.voice ? { voice: p.voice } : {}),
        ...(p.voiceId ? { voice_id: p.voiceId } : {}),
      };
    case CAPABILITY.MUSIC:
      return {
        prompt: p.prompt,
        ...(p.durationSec ? { duration: p.durationSec } : {}),
      };
    case CAPABILITY.TRANSCRIBE:
      return { audio_url: p.audioUrl, task: "transcribe", ...(p.language ? { language: p.language } : {}) };
    default:
      return { ...p };
  }
}

// ---- fal output payload -> normalized assets -----------------------------
function normalizeOutput(capability, data = {}) {
  const kind = CAPABILITY_OUTPUT[capability];
  if (kind === "image") {
    const imgs = data.images || (data.image ? [data.image] : []);
    return imgs.map((im) => ({
      kind: "image",
      url: im.url || im,
      mimeType: im.content_type || "image/png",
      width: im.width,
      height: im.height,
    }));
  }
  if (kind === "video") {
    const v = data.video || data.videos?.[0];
    if (!v) return [];
    return [{ kind: "video", url: v.url || v, mimeType: v.content_type || "video/mp4" }];
  }
  if (kind === "audio") {
    const a = data.audio || data.audio_file || (data.audio_url ? { url: data.audio_url } : null);
    if (!a) return [];
    return [{ kind: "audio", url: a.url || a, mimeType: a.content_type || "audio/mpeg" }];
  }
  // transcribe — fal whisper returns chunks/words
  return [{ kind: "data", data }];
}

export const falProvider = {
  name: "fal",
  supports: new Set(Object.values(CAPABILITY)),

  available() {
    return Boolean(key());
  },

  async submit(capability, params = {}) {
    const model = modelFor(capability);
    if (!model) throw new Error(`fal has no model mapped for capability "${capability}"`);
    const res = await fetch(`${QUEUE_BASE}/${model}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(buildInput(capability, params)),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`fal submit (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    if (!data.request_id) throw new Error("fal submit returned no request_id");
    return {
      jobId: data.request_id,
      statusUrl: data.status_url,
      responseUrl: data.response_url,
      model,
    };
  },

  async poll(jobId, handle = {}) {
    const model = handle.model;
    const statusUrl = handle.statusUrl || `${QUEUE_BASE}/${model}/requests/${jobId}/status`;
    const responseUrl = handle.responseUrl || `${QUEUE_BASE}/${model}/requests/${jobId}`;

    const res = await fetch(statusUrl, { headers: authHeaders() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`fal status (${res.status}): ${body.slice(0, 200)}`);
    }
    const s = await res.json();

    if (s.status === "COMPLETED") {
      const r = await fetch(responseUrl, { headers: authHeaders() });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        throw new Error(`fal result (${r.status}): ${body.slice(0, 200)}`);
      }
      const out = await r.json();
      return { status: "done", assets: normalizeOutput(handle.capability, out), raw: out };
    }
    if (s.status === "IN_PROGRESS") return { status: "running", progress: 0.5 };
    if (s.status === "IN_QUEUE") return { status: "queued", progress: 0 };
    return { status: "failed", error: `fal status: ${s.status || "unknown"}` };
  },
};
