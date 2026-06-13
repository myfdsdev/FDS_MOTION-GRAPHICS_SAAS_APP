// Code-gen orchestrator: prompt → enhanced brief → Remotion .tsx → validated.
//
// This is the heart of the new architecture. It does NOT render — it just
// produces a validated component source string. The CLI (render-component.js)
// and the worker call this, then bundle + renderMedia the result.

import { callLLM, hasAnyProvider } from "./providers/index.js";
import { validateComponent } from "./validate.js";
import { COMPONENT_SYSTEM_PROMPT } from "./prompts/component.js";
import { RETRY_SYSTEM_PROMPT } from "./prompts/retry.js";
import { ENHANCE_SYSTEM_PROMPT } from "./prompts/enhance.js";
import { REVIEW_SYSTEM_PROMPT } from "./prompts/review.js";

const FPS = 30;
const DIMENSIONS = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:3": [1440, 1080],
};

function fillTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : ""));
}

/**
 * Turn a rough user idea into a precise creative brief. Falls back to the raw
 * prompt if the enhance call fails — never block generation on it.
 */
export async function enhanceBrief(userPrompt) {
  try {
    const brief = await callLLM({
      system: ENHANCE_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 400,
    });
    return brief.trim() || userPrompt;
  } catch (err) {
    console.warn("[codegen] enhance failed, using raw prompt:", err?.message || err);
    return userPrompt;
  }
}

/**
 * Generate a validated Remotion component for a prompt.
 *
 * @param {object} o
 * @param {string} o.prompt           user's idea
 * @param {number} [o.durationSec]    default 20
 * @param {"16:9"|"9:16"|"1:1"|"4:3"} [o.aspect]
 * @param {boolean} [o.premium]       use premium model + review pass
 * @param {(stage:string)=>void} [o.onProgress]
 * @returns {Promise<{ source:string, brief:string, width:number, height:number, durationInFrames:number, fps:number }>}
 */
export async function generateComponent({
  prompt,
  durationSec = 20,
  aspect = "16:9",
  premium = false,
  onProgress = () => {},
}) {
  if (!hasAnyProvider()) {
    throw new Error(
      "No LLM provider configured. Set ANTHROPIC_API_KEY (recommended) in backend/.env."
    );
  }
  const [width, height] = DIMENSIONS[aspect] || DIMENSIONS["16:9"];
  const durationInFrames = Math.max(1, Math.round(durationSec * FPS));

  onProgress("enhancing");
  const brief = await enhanceBrief(prompt);

  const system = fillTemplate(COMPONENT_SYSTEM_PROMPT, {
    durationSec,
    fps: FPS,
    durationInFrames,
    width,
    height,
  });

  onProgress("generating");
  let raw = await callLLM({ system, user: brief, premium, maxTokens: 8000 });
  let result = validateComponent(raw);

  // Retry loop — feed the validation error back to the model.
  for (let attempt = 0; attempt < 2 && !result.ok; attempt++) {
    onProgress(`retrying (${attempt + 1})`);
    const retrySystem = fillTemplate(RETRY_SYSTEM_PROMPT, { ERROR: result.error });
    raw = await callLLM({
      system: retrySystem,
      user: validateComponent(raw).code || stripSafe(raw),
      maxTokens: 8000,
    });
    result = validateComponent(raw);
  }

  if (!result.ok) {
    throw new Error(`Generated component failed validation after retries:\n${result.error}`);
  }

  let source = result.code;

  // Premium tier: one review/improve pass. Non-fatal — keep the valid source
  // if review produces something that no longer validates.
  if (premium) {
    onProgress("reviewing");
    try {
      const reviewed = await callLLM({
        system: REVIEW_SYSTEM_PROMPT,
        user: `Brief:\n${brief}\n\nCode:\n${source}`,
        premium: true,
        maxTokens: 8000,
      });
      const rv = validateComponent(reviewed);
      if (rv.ok) source = rv.code;
    } catch (err) {
      console.warn("[codegen] review pass skipped:", err?.message || err);
    }
  }

  onProgress("done");
  return { source, brief, width, height, durationInFrames, fps: FPS };
}

function stripSafe(raw) {
  return typeof raw === "string" ? raw : "";
}

/**
 * Repair a component that FAILED at bundle/render time (not validation). The
 * error often surfaces a hallucinated API (e.g. `spring().to()`); we feed the
 * exact error + broken source back to the model and re-validate the fix.
 *
 * @returns {Promise<string>} a validated, fixed component source
 */
export async function fixComponent({ brokenSource, error }) {
  let repairError = error;
  let raw = brokenSource;
  let result = { ok: false, error: String(error || "Render failed"), code: null };

  for (let attempt = 0; attempt < 3 && !result.ok; attempt++) {
    const retrySystem = fillTemplate(RETRY_SYSTEM_PROMPT, { ERROR: repairError });
    raw = await callLLM({
      system: retrySystem,
      user: result.code || stripSafe(raw),
      maxTokens: 8000,
    });
    result = validateComponent(raw);
    repairError = result.ok ? null : result.error;
  }

  if (!result.ok) {
    throw new Error(`Repaired component still failed validation:\n${result.error}`);
  }
  return result.code;
}
