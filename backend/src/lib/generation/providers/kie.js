// kie.ai provider — UNIFIED JOBS API. One pair of endpoints handles ANY kie
// model (nano-banana-pro, veo3, kling, suno, …); the model name is just a
// string in the request body:
//   POST /api/v1/jobs/createTask  { model, input:{...} } -> { code, data:{ taskId } }
//   GET  /api/v1/jobs/recordInfo?taskId=..               -> { data:{ state, resultJson } }
//     state: "waiting" | "success" | "fail"
//     resultJson (string): { "resultUrls": [...] } for media
//
// Model resolution (most specific first):
//   params.model  ->  admin custom model (providers manager)  ->  env  ->  default
// So you can run any model by typing it in the admin, or passing it per call.
// Auth: Authorization: Bearer <key>.

import { CAPABILITY, CAPABILITY_OUTPUT } from "../capabilities.js";
import { getProviderKey } from "../../providerKeys.js";
import { getModel } from "../../providerModels.js";
import { getCustomModel } from "../../providersConfig.js";

const BASE = process.env.KIE_API_BASE || "https://api.kie.ai";
const CREATE_PATH = "/api/v1/jobs/createTask";
const RECORD_PATH = "/api/v1/jobs/recordInfo";

// Sensible defaults per capability — overridable everywhere.
const DEFAULT_MODELS = {
  [CAPABILITY.TEXT_TO_IMAGE]: "nano-banana-pro",
  [CAPABILITY.IMAGE_TO_VIDEO]: "kling-2.6/image-to-video",
  [CAPABILITY.TEXT_TO_VIDEO]: "kling-2.6/text-to-video",
  [CAPABILITY.MUSIC]: "suno-v5",
};

// kie aspect-ratio options (Jobs API). Map our aspect strings through.
const KIE_RATIOS = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "auto"]);
const DEFAULT_VIDEO_DURATIONS = Object.freeze([5]);

function key() {
  return getProviderKey("kie") || process.env.KIE_API_KEY || process.env.KIE_KEY || "";
}
function authHeaders() {
  return { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" };
}

function modelFor(capability, params = {}) {
  const model =
    params.model ||
    getCustomModel("kie", capability) ||
    getModel(`KIE_MODEL_${capability.toUpperCase()}`, DEFAULT_MODELS[capability] || "");
  return normalizeModel(capability, model);
}

function normalizeModel(capability, model = "") {
  const clean = String(model || "").trim();
  const lower = clean.toLowerCase();

  if (["veo3", "veo-3", "veo3.1", "veo-3.1", "kling-2", "kling2"].includes(lower)) {
    if (capability === CAPABILITY.IMAGE_TO_VIDEO) return DEFAULT_MODELS[CAPABILITY.IMAGE_TO_VIDEO];
    if (capability === CAPABILITY.TEXT_TO_VIDEO) return DEFAULT_MODELS[CAPABILITY.TEXT_TO_VIDEO];
  }

  return clean;
}

function ratioOf(params = {}) {
  const r = params.aspectRatio || params.imageSize;
  return r && KIE_RATIOS.has(r) ? r : "1:1";
}

function allowedVideoDurations() {
  const values = String(process.env.KIE_VIDEO_DURATIONS || "")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  return values.length ? values : DEFAULT_VIDEO_DURATIONS;
}

function durationOf(params = {}) {
  const requested = Number(params.durationSec) || DEFAULT_VIDEO_DURATIONS[0];
  const allowed = allowedVideoDurations();
  const next = allowed.find((v) => v >= requested);
  return String(next ?? allowed[allowed.length - 1]);
}

function buildInput(capability, p = {}) {
  const images = p.imageUrl ? [p.imageUrl] : Array.isArray(p.imageInput) ? p.imageInput : [];
  const duration = durationOf(p);
  switch (capability) {
    case CAPABILITY.TEXT_TO_IMAGE:
      return {
        prompt: p.prompt,
        image_input: images,
        aspect_ratio: ratioOf(p),
        resolution: p.resolution || "1K",
        output_format: p.outputFormat || "png",
      };
    case CAPABILITY.IMAGE_TO_VIDEO:
      return {
        prompt: p.prompt || "",
        image_urls: images,
        sound: Boolean(p.sound),
        duration,
      };
    case CAPABILITY.TEXT_TO_VIDEO:
      return {
        prompt: p.prompt || "",
        sound: Boolean(p.sound),
        aspect_ratio: ratioOf(p),
        duration,
      };
    case CAPABILITY.MUSIC:
      return { prompt: p.prompt, ...(p.durationSec ? { duration: p.durationSec } : {}) };
    default:
      return { prompt: p.prompt, image_input: images };
  }
}

function resultUrlsFrom(data = {}) {
  // resultJson is a JSON string: { resultUrls: [...] } | { resultObject: {...} }
  try {
    const parsed = JSON.parse(data.resultJson || "{}");
    if (Array.isArray(parsed.resultUrls)) return parsed.resultUrls;
    if (parsed.resultObject) return [];
  } catch {
    /* ignore */
  }
  return [];
}

export const kieProvider = {
  name: "kie",
  supports: new Set(Object.values(CAPABILITY)),

  available() {
    return Boolean(key());
  },

  async submit(capability, params = {}) {
    const model = modelFor(capability, params);
    if (!model) throw new Error(`kie: no model resolved for ${capability}`);
    const res = await fetch(`${BASE}${CREATE_PATH}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ model, input: buildInput(capability, params) }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`kie createTask (${res.status}): ${body.slice(0, 300)}`);
    }
    const body = await res.json();
    if (body.code && body.code !== 200) {
      throw new Error(`kie createTask code ${body.code}: ${body.msg || "error"}`);
    }
    const taskId = body?.data?.taskId;
    if (!taskId) throw new Error(`kie createTask: no taskId in ${JSON.stringify(body).slice(0, 200)}`);
    return { jobId: taskId, model };
  },

  async poll(jobId, handle = {}) {
    const res = await fetch(`${BASE}${RECORD_PATH}?taskId=${encodeURIComponent(jobId)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`kie recordInfo (${res.status}): ${body.slice(0, 200)}`);
    }
    const body = await res.json();
    const d = body?.data || {};
    const state = String(d.state || "").toLowerCase();

    if (state === "success") {
      const urls = resultUrlsFrom(d);
      const kind = CAPABILITY_OUTPUT[handle.capability] || "image";
      const mime = kind === "video" ? "video/mp4" : kind === "audio" ? "audio/mpeg" : "image/png";
      return { status: "done", assets: urls.map((url) => ({ kind, url, mimeType: mime })), raw: d };
    }
    if (state === "fail") {
      return { status: "failed", error: d.failMsg || d.failCode || "kie task failed" };
    }
    return { status: "running" }; // waiting
  },
};
