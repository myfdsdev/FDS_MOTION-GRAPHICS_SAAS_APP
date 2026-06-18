// Runway provider — Gen-4/Gen-3 image→video and text→image via Runway's
// official API (api.dev.runwayml.com). Task pattern:
//   POST /v1/image_to_video | /v1/text_to_image  -> { id }
//   GET  /v1/tasks/{id}                           -> { status, output: [url...] }
//
// Auth: `Authorization: Bearer <key>` + required `X-Runway-Version` header.
// Runway video models need a START IMAGE (image→video) — so a text-only video
// is done as text→image then image→video upstream. Model/version/ratios are
// overridable via env; verify against https://docs.dev.runwayml.com.

import { CAPABILITY } from "../capabilities.js";
import { getProviderKey } from "../../providerKeys.js";

const BASE = process.env.RUNWAY_API_BASE || "https://api.dev.runwayml.com";
const API_VERSION = process.env.RUNWAY_API_VERSION || "2024-11-06";

function key() {
  return getProviderKey("runway") || process.env.RUNWAYML_API_SECRET || "";
}
function headers() {
  return {
    Authorization: `Bearer ${key()}`,
    "X-Runway-Version": API_VERSION,
    "Content-Type": "application/json",
  };
}

// Runway accepts specific pixel ratios, not "16:9" strings.
function ratioFor(aspect) {
  switch (aspect) {
    case "9:16": return "720:1280";
    case "1:1": return "960:960";
    case "4:3": return "1104:832";
    default: return "1280:720"; // 16:9
  }
}

function endpoint(capability) {
  if (capability === CAPABILITY.TEXT_TO_IMAGE) return "/v1/text_to_image";
  return "/v1/image_to_video"; // image_to_video + text_to_video both start here
}

function buildInput(capability, p = {}) {
  if (capability === CAPABILITY.TEXT_TO_IMAGE) {
    return {
      model: process.env.RUNWAY_IMAGE_MODEL || "gen4_image",
      promptText: p.prompt,
      ratio: ratioFor(p.aspectRatio),
    };
  }
  // image_to_video
  return {
    model: process.env.RUNWAY_VIDEO_MODEL || "gen4_turbo",
    promptImage: p.imageUrl,
    promptText: p.prompt || "",
    ratio: ratioFor(p.aspectRatio),
    duration: Number(p.durationSec) || 5,
  };
}

export const runwayProvider = {
  name: "runway",
  // Runway = video from an image, and stills. No TTS/music.
  supports: new Set([CAPABILITY.IMAGE_TO_VIDEO, CAPABILITY.TEXT_TO_VIDEO, CAPABILITY.TEXT_TO_IMAGE]),

  available() {
    return Boolean(key());
  },

  async submit(capability, params = {}) {
    const res = await fetch(`${BASE}${endpoint(capability)}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(buildInput(capability, params)),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`runway submit (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    if (!data.id) throw new Error(`runway submit returned no task id: ${JSON.stringify(data).slice(0, 200)}`);
    return { jobId: data.id };
  },

  async poll(jobId, handle = {}) {
    const res = await fetch(`${BASE}/v1/tasks/${jobId}`, { headers: headers() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`runway task (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const status = String(data.status || "").toUpperCase();

    if (status === "SUCCEEDED") {
      const urls = data.output || [];
      const kind = handle.capability === CAPABILITY.TEXT_TO_IMAGE ? "image" : "video";
      const mime = kind === "image" ? "image/png" : "video/mp4";
      return { status: "done", assets: urls.map((url) => ({ kind, url, mimeType: mime })), raw: data };
    }
    if (status === "FAILED" || status === "CANCELLED") {
      return { status: "failed", error: data.failure || data.failureCode || "runway task failed" };
    }
    if (status === "THROTTLED" || status === "PENDING") return { status: "queued" };
    return { status: "running" }; // RUNNING
  },
};
