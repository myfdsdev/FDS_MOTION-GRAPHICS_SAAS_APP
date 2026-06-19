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

// Music uses kie's DEDICATED Suno API (not the unified Jobs API):
//   POST /api/v1/generate              { prompt, customMode, instrumental, model, callBackUrl, ... } -> { data:{ taskId } }
//   GET  /api/v1/generate/record-info?taskId=  -> { data:{ status, response:{ sunoData:[{ audioUrl }] } } }
// Same kie Bearer key. callBackUrl is required by the API even though we poll.
const SUNO_CREATE_PATH = "/api/v1/generate";
const SUNO_RECORD_PATH = "/api/v1/generate/record-info";
const SUNO_MODELS = new Set(["V3_5", "V4", "V4_5", "V4_5PLUS", "V5"]);

// Sensible defaults per capability — overridable everywhere.
const DEFAULT_MODELS = {
  [CAPABILITY.TEXT_TO_IMAGE]: "nano-banana-pro",
  [CAPABILITY.IMAGE_TO_VIDEO]: "grok-imagine/image-to-video",
  [CAPABILITY.TEXT_TO_VIDEO]: "kling-2.6/text-to-video",
  [CAPABILITY.MUSIC]: "V5",
};

// kie aspect-ratio options (Jobs API). Map our aspect strings through.
const KIE_RATIOS = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "auto"]);
const DEFAULT_VIDEO_DURATIONS = Object.freeze([5]);
const DEFAULT_GROK_VIDEO_DURATIONS = Object.freeze([6]);

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

/* ----------------------------- Suno (music) ----------------------------- */

// Resolve + normalize the Suno model. Accepts "V5", "suno-v5", "V4.5", etc.
function sunoModelFor(params = {}) {
  const raw =
    params.model ||
    getCustomModel("kie", CAPABILITY.MUSIC) ||
    getModel(`KIE_MODEL_${CAPABILITY.MUSIC.toUpperCase()}`, DEFAULT_MODELS[CAPABILITY.MUSIC]);
  const norm = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/^SUNO[-_]?/, "") // "suno-v5" -> "V5"
    .replace(/\./g, "_"); // "V4.5" -> "V4_5"
  return SUNO_MODELS.has(norm) ? norm : DEFAULT_MODELS[CAPABILITY.MUSIC];
}

// kie's Suno API requires a callBackUrl. We poll for the result, so this only
// needs to be a syntactically valid URL — set KIE_CALLBACK_URL (or PUBLIC_BASE_URL)
// to your real webhook if you ever switch to callback delivery.
function sunoCallbackUrl() {
  if (process.env.KIE_CALLBACK_URL) return process.env.KIE_CALLBACK_URL;
  const base = process.env.PUBLIC_BASE_URL || "";
  if (base) return `${base.replace(/\/+$/, "")}/api/webhooks/suno`;
  return "https://example.com/callback";
}

function buildSunoBody(p = {}, model = "") {
  const customMode = Boolean(p.customMode);
  const body = {
    prompt: p.prompt || p.musicPrompt || "",
    customMode,
    instrumental: p.instrumental ?? true, // default to instrumental — it rides UNDER narration
    model,
    callBackUrl: sunoCallbackUrl(),
  };
  // Custom mode requires style + title (and prompt is treated as lyrics when
  // instrumental is false). Pass them through when present.
  if (customMode) {
    if (p.style) body.style = p.style;
    if (p.title) body.title = p.title;
  }
  // Optional Suno tuning knobs — forwarded only when the caller supplies them.
  for (const k of [
    "style",
    "title",
    "negativeTags",
    "vocalGender",
    "styleWeight",
    "weirdnessConstraint",
    "audioWeight",
    "personaId",
    "personaModel",
  ]) {
    if (p[k] !== undefined && body[k] === undefined) body[k] = p[k];
  }
  return body;
}

async function submitSuno(params = {}) {
  const model = sunoModelFor(params);
  const res = await fetch(`${BASE}${SUNO_CREATE_PATH}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(buildSunoBody(params, model)),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`kie suno generate (${res.status}): ${body.slice(0, 300)}`);
  }
  const body = await res.json();
  if (body.code && body.code !== 200) {
    throw new Error(`kie suno generate code ${body.code}: ${body.msg || "error"}`);
  }
  const taskId = body?.data?.taskId || body?.data?.task_id;
  if (!taskId) throw new Error(`kie suno generate: no taskId in ${JSON.stringify(body).slice(0, 200)}`);
  return { jobId: taskId, model, endpoint: "suno" };
}

// Suno status: PENDING | TEXT_SUCCESS | FIRST_SUCCESS | SUCCESS |
//   CREATE_TASK_FAILED | GENERATE_AUDIO_FAILED | CALLBACK_EXCEPTION | SENSITIVE_WORD_ERROR
const SUNO_FAIL = /FAILED|ERROR|EXCEPTION/;

function sunoAudioUrls(data = {}) {
  const tracks = data?.response?.sunoData || data?.response?.data || [];
  return (Array.isArray(tracks) ? tracks : [])
    .map((t) => t?.audioUrl || t?.sourceAudioUrl || t?.streamAudioUrl)
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u));
}

async function pollSuno(jobId) {
  const res = await fetch(`${BASE}${SUNO_RECORD_PATH}?taskId=${encodeURIComponent(jobId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`kie suno record-info (${res.status}): ${body.slice(0, 200)}`);
  }
  const body = await res.json();
  const d = body?.data || {};
  const status = String(d.status || "").toUpperCase();

  if (status === "SUCCESS") {
    const urls = sunoAudioUrls(d);
    if (!urls.length) return { status: "failed", error: "suno success but no audioUrl" };
    return {
      status: "done",
      assets: urls.map((url) => ({ kind: "audio", url, mimeType: "audio/mpeg" })),
      raw: d,
    };
  }
  if (SUNO_FAIL.test(status)) {
    return { status: "failed", error: d.errorMessage || d.errorCode || status || "suno task failed" };
  }
  return { status: "running" }; // PENDING / TEXT_SUCCESS / FIRST_SUCCESS
}

/* ------------------------------------------------------------------------ */

function ratioOf(params = {}) {
  const r = params.aspectRatio || params.imageSize;
  return r && KIE_RATIOS.has(r) ? r : "1:1";
}

function isGrokImagine(model = "") {
  return String(model).toLowerCase().startsWith("grok-imagine/");
}

function allowedVideoDurations(model = "") {
  const raw = isGrokImagine(model)
    ? process.env.KIE_GROK_VIDEO_DURATIONS || process.env.KIE_VIDEO_DURATIONS || ""
    : process.env.KIE_VIDEO_DURATIONS || "";
  const values = String(raw)
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (values.length) return values;
  return isGrokImagine(model) ? DEFAULT_GROK_VIDEO_DURATIONS : DEFAULT_VIDEO_DURATIONS;
}

function durationOf(model = "", params = {}) {
  const fallback = isGrokImagine(model) ? DEFAULT_GROK_VIDEO_DURATIONS[0] : DEFAULT_VIDEO_DURATIONS[0];
  const requested = Number(params.durationSec) || fallback;
  const allowed = allowedVideoDurations(model);
  const next = allowed.find((v) => v >= requested);
  return String(next ?? allowed[allowed.length - 1]);
}

function buildInput(capability, p = {}, model = "") {
  const images = p.imageUrl ? [p.imageUrl] : Array.isArray(p.imageInput) ? p.imageInput : [];
  const duration = durationOf(model, p);
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
      if (isGrokImagine(model)) {
        return {
          task_id: p.taskId || p.jobId || `task_${Date.now()}`,
          image_urls: images,
          prompt: p.prompt || "",
          mode: p.mode || process.env.KIE_GROK_MODE || "normal",
          duration,
          resolution: p.resolution || process.env.KIE_GROK_RESOLUTION || "480p",
          aspect_ratio: ratioOf(p),
        };
      }
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
    if (parsed.resultObject) return collectUrls(parsed.resultObject);
  } catch {
    /* ignore */
  }
  return [];
}

function collectUrls(value, acc = []) {
  if (!value) return acc;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, acc);
    return acc;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) collectUrls(item, acc);
  }
  return acc;
}

export const kieProvider = {
  name: "kie",
  supports: new Set(Object.values(CAPABILITY)),

  available() {
    return Boolean(key());
  },

  async submit(capability, params = {}) {
    // Music goes through the dedicated Suno API, not the unified Jobs API.
    if (capability === CAPABILITY.MUSIC) return submitSuno(params);

    const model = modelFor(capability, params);
    if (!model) throw new Error(`kie: no model resolved for ${capability}`);
    const res = await fetch(`${BASE}${CREATE_PATH}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ model, input: buildInput(capability, params, model) }),
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
    // Suno tasks are polled at their own record-info endpoint.
    if (handle.endpoint === "suno" || handle.capability === CAPABILITY.MUSIC) return pollSuno(jobId);

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
