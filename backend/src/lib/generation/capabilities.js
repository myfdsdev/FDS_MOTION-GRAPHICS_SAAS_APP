// Generative-asset capabilities — the "what" of the shared generation engine.
//
// Every external generation (image, video, voice, music, transcription) flows
// through ONE engine that speaks these capability names. Providers (fal.ai,
// mock, future direct vendors) declare which capabilities they support; the
// engine routes by capability, not by vendor. Cost estimators here power the
// budget/credit check BEFORE we spend real money on a job.
//
// Rough cost estimates are deliberately conservative (over-estimate slightly)
// and overridable — they exist to gate spend and show the user a price, not to
// bill exactly. Reconcile against the provider's reported cost after the job.

export const CAPABILITY = {
  TEXT_TO_IMAGE: "text_to_image",
  IMAGE_TO_VIDEO: "image_to_video",
  TEXT_TO_VIDEO: "text_to_video",
  VIDEO_TO_VIDEO: "video_to_video",
  REFERENCE_TO_VIDEO: "reference_to_video",
  TEXT_TO_SPEECH: "text_to_speech",
  MUSIC: "music",
  TRANSCRIBE: "transcribe",
};

/** Asset kind each capability is expected to produce. */
export const CAPABILITY_OUTPUT = {
  [CAPABILITY.TEXT_TO_IMAGE]: "image",
  [CAPABILITY.IMAGE_TO_VIDEO]: "video",
  [CAPABILITY.TEXT_TO_VIDEO]: "video",
  [CAPABILITY.VIDEO_TO_VIDEO]: "video",
  [CAPABILITY.REFERENCE_TO_VIDEO]: "video",
  [CAPABILITY.TEXT_TO_SPEECH]: "audio",
  [CAPABILITY.MUSIC]: "audio",
  [CAPABILITY.TRANSCRIBE]: "data",
};

// Per-capability metadata: required params + a rough USD estimator.
export const CAPABILITIES = {
  [CAPABILITY.TEXT_TO_IMAGE]: {
    label: "Text → Image",
    required: ["prompt"],
    estimate: (p = {}) => round(0.02 * (p.numImages || 1)),
  },
  [CAPABILITY.IMAGE_TO_VIDEO]: {
    label: "Image → Video",
    required: ["imageUrl"],
    // Image-to-video is the expensive one — price per generated second.
    estimate: (p = {}) => round(0.09 * clamp(p.durationSec || 5, 1, 30)),
  },
  [CAPABILITY.TEXT_TO_VIDEO]: {
    label: "Text → Video",
    required: ["prompt"],
    estimate: (p = {}) => round(0.12 * clamp(p.durationSec || 5, 1, 30)),
  },
  [CAPABILITY.VIDEO_TO_VIDEO]: {
    label: "Video → Video (restyle)",
    required: ["sourceVideoUrl"],
    estimate: (p = {}) => round(0.1 * clamp(p.durationSec || 5, 1, 30)),
  },
  [CAPABILITY.REFERENCE_TO_VIDEO]: {
    label: "Reference → Video",
    required: ["prompt"],
    estimate: (p = {}) => round(0.12 * clamp(p.durationSec || 5, 1, 30)),
  },
  [CAPABILITY.TEXT_TO_SPEECH]: {
    label: "Text → Speech",
    required: ["text"],
    // ~$0.00003 / char, floored — cheap, safe to test first.
    estimate: (p = {}) => round(Math.max(0.01, 0.00003 * String(p.text || "").length)),
  },
  [CAPABILITY.MUSIC]: {
    label: "Music",
    required: ["prompt"],
    estimate: (p = {}) => round(0.02 * Math.ceil(clamp(p.durationSec || 30, 5, 300) / 30)),
  },
  [CAPABILITY.TRANSCRIBE]: {
    label: "Transcribe (word timings)",
    required: ["audioUrl"],
    estimate: (p = {}) => round(0.006 * Math.ceil(clamp(p.durationSec || 60, 1, 3600) / 60)),
  },
};

export function isKnownCapability(capability) {
  return Object.prototype.hasOwnProperty.call(CAPABILITIES, capability);
}

/** Throw if required params for a capability are missing. */
export function assertParams(capability, params = {}) {
  const meta = CAPABILITIES[capability];
  if (!meta) throw new Error(`Unknown capability: ${capability}`);
  const missing = meta.required.filter((k) => params[k] == null || params[k] === "");
  if (missing.length) {
    throw new Error(`${capability} missing required param(s): ${missing.join(", ")}`);
  }
}

/** Conservative USD estimate for a job, used to gate spend before submitting. */
export function estimateCost(capability, params = {}) {
  const meta = CAPABILITIES[capability];
  return meta ? meta.estimate(params) : 0;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Number(n) || lo));
}
function round(n) {
  return Math.round(n * 1000) / 1000;
}
