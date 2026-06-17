// kie.ai provider — second media-gen aggregator alongside fal. kie.ai uses a
// task pattern that's uniform across its model families:
//   POST <createPath>            -> { code, data: { taskId } }
//   GET  <recordPath>?taskId=..  -> { data: { successFlag|status, resultUrls|response } }
//
// The EXACT paths differ per model family (Veo / Flux / 4o-image / Suno / ...),
// so each capability carries its own createPath/recordPath/model, all overridable
// via env (KIE_*). The defaults below follow kie.ai's documented shape but MUST
// be verified against your kie.ai dashboard/docs — treat them as placeholders to
// confirm, exactly like the fal model slugs. Auth: `Authorization: Bearer <key>`.

import { CAPABILITY, CAPABILITY_OUTPUT } from "../capabilities.js";

const BASE = process.env.KIE_API_BASE || "https://api.kie.ai";

function key() {
  return process.env.KIE_API_KEY || process.env.KIE_KEY || "";
}
function authHeaders() {
  return { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" };
}

// Per-capability endpoint + model config. VERIFY paths/models against kie.ai docs.
function configFor(capability) {
  const env = (suffix, fallback) => process.env[`KIE_${capability.toUpperCase()}_${suffix}`] || fallback;
  switch (capability) {
    case CAPABILITY.TEXT_TO_IMAGE:
      return { create: env("CREATE", "/api/v1/gpt4o-image/generate"), record: env("RECORD", "/api/v1/gpt4o-image/record-info"), model: env("MODEL", "") };
    case CAPABILITY.IMAGE_TO_VIDEO:
      return { create: env("CREATE", "/api/v1/veo/generate"), record: env("RECORD", "/api/v1/veo/record-info"), model: env("MODEL", "veo3_fast") };
    case CAPABILITY.TEXT_TO_VIDEO:
      return { create: env("CREATE", "/api/v1/veo/generate"), record: env("RECORD", "/api/v1/veo/record-info"), model: env("MODEL", "veo3_fast") };
    case CAPABILITY.MUSIC:
      return { create: env("CREATE", "/api/v1/generate"), record: env("RECORD", "/api/v1/generate/record-info"), model: env("MODEL", "") };
    case CAPABILITY.TEXT_TO_SPEECH:
      return { create: env("CREATE", "/api/v1/tts/generate"), record: env("RECORD", "/api/v1/tts/record-info"), model: env("MODEL", "") };
    case CAPABILITY.TRANSCRIBE:
      return { create: env("CREATE", "/api/v1/transcribe/generate"), record: env("RECORD", "/api/v1/transcribe/record-info"), model: env("MODEL", "") };
    default:
      return null;
  }
}

function buildInput(capability, model, p = {}) {
  const withModel = (o) => (model ? { model, ...o } : o);
  switch (capability) {
    case CAPABILITY.TEXT_TO_IMAGE:
      return withModel({ prompt: p.prompt, size: p.imageSize || "16:9", nVariants: p.numImages || 1 });
    case CAPABILITY.IMAGE_TO_VIDEO:
      return withModel({ prompt: p.prompt || "", imageUrls: p.imageUrl ? [p.imageUrl] : [], aspectRatio: p.aspectRatio || "16:9" });
    case CAPABILITY.TEXT_TO_VIDEO:
      return withModel({ prompt: p.prompt, aspectRatio: p.aspectRatio || "16:9" });
    case CAPABILITY.MUSIC:
      return withModel({ prompt: p.prompt, ...(p.durationSec ? { duration: p.durationSec } : {}) });
    case CAPABILITY.TEXT_TO_SPEECH:
      return withModel({ text: p.text, ...(p.voice ? { voice: p.voice } : {}) });
    case CAPABILITY.TRANSCRIBE:
      return withModel({ audioUrl: p.audioUrl, ...(p.language ? { language: p.language } : {}) });
    default:
      return withModel({ ...p });
  }
}

function pickTaskId(body) {
  return body?.data?.taskId || body?.data?.task_id || body?.taskId || body?.data?.id || null;
}

// kie status is reported a few different ways across families; handle them all.
function readStatus(data = {}) {
  const flag = data.successFlag ?? data.success_flag;
  if (flag === 1 || flag === "1") return "done";
  if (flag === 2 || flag === 3 || flag === "2" || flag === "3") return "failed";
  const s = String(data.status || data.state || "").toLowerCase();
  if (["success", "succeeded", "completed", "done"].includes(s)) return "done";
  if (["failed", "error", "fail"].includes(s)) return "failed";
  return "running";
}

function extractUrls(data = {}) {
  return (
    data.resultUrls ||
    data.result_urls ||
    data.response?.resultUrls ||
    data.info?.resultUrls ||
    (data.resultUrl ? [data.resultUrl] : null) ||
    (data.response?.resultUrl ? [data.response.resultUrl] : null) ||
    []
  );
}

function normalize(capability, data) {
  const kind = CAPABILITY_OUTPUT[capability];
  if (kind === "data") return [{ kind: "data", data }];
  const urls = extractUrls(data);
  const mime = kind === "image" ? "image/png" : kind === "video" ? "video/mp4" : "audio/mpeg";
  return urls.map((url) => ({ kind, url, mimeType: mime }));
}

export const kieProvider = {
  name: "kie",
  supports: new Set(Object.values(CAPABILITY)),

  available() {
    return Boolean(key());
  },

  async submit(capability, params = {}) {
    const cfg = configFor(capability);
    if (!cfg) throw new Error(`kie has no endpoint mapped for capability "${capability}"`);
    const res = await fetch(`${BASE}${cfg.create}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(buildInput(capability, cfg.model, params)),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`kie submit (${res.status}): ${body.slice(0, 300)}`);
    }
    const body = await res.json();
    const taskId = pickTaskId(body);
    if (!taskId) throw new Error(`kie submit returned no taskId: ${JSON.stringify(body).slice(0, 200)}`);
    return { jobId: taskId, recordPath: cfg.record };
  },

  async poll(jobId, handle = {}) {
    const recordPath = handle.recordPath || configFor(handle.capability)?.record;
    const res = await fetch(`${BASE}${recordPath}?taskId=${encodeURIComponent(jobId)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`kie record (${res.status}): ${body.slice(0, 200)}`);
    }
    const body = await res.json();
    const data = body.data || body;
    const status = readStatus(data);
    if (status === "done") return { status: "done", assets: normalize(handle.capability, data), raw: data };
    if (status === "failed") return { status: "failed", error: data.errorMessage || data.msg || "kie task failed" };
    return { status: "running", progress: data.progress };
  },
};
