// planScenes — produce a validated scenePlan from a user description.
//
//   user text → LLM (scene-planner prompt) → parse JSON → 6-check gate
//
// The validation gate (doc §8) is what stops content drift and malformed plans
// from ever burning generation credits. Only a plan that passes ALL checks is
// returned; otherwise the caller re-asks (feed the error back to the model).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { callLLM } from "../providers/index.js";
import { SCENE_PLANNER_SYSTEM_PROMPT } from "../prompts/scenePlanner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, "../../schemas/scene_plan.schema.json");

const OVERLAY_TYPES = new Set([
  "heroTitle", "sectionTitle", "textCard", "statCard", "statReveal",
  "calloutBox", "comparisonCard", "progressBar", "providerChip",
  "barChart", "lineChart", "pieChart", "kpiGrid", "particles",
]);

// Per-model max clip length (seconds). Keep durations <= this for "generate".
const PROVIDER_MAX_SECONDS = Number(process.env.GEN_MAX_CLIP_SECONDS || 10);

let _validate = null;
function getValidator() {
  if (_validate) return _validate;
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  _validate = ajv.compile(schema);
  return _validate;
}

/** Pull the first balanced JSON object out of a model reply. */
function extractJson(raw) {
  const s = String(raw || "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Lowercased subject tokens for the anti-drift check. */
function subjectTokens(userText) {
  return String(userText || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4); // skip tiny filler words
}

/**
 * Run the doc §8 validation gate on a parsed plan.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateScenePlan(plan, userText = "") {
  const errors = [];
  if (!plan || typeof plan !== "object") return { ok: false, errors: ["plan is not an object"] };

  // 1. Schema
  const validate = getValidator();
  if (!validate(plan)) {
    for (const e of validate.errors || []) errors.push(`schema ${e.instancePath || "/"} ${e.message}`);
  }

  const scenes = Array.isArray(plan.scenes) ? plan.scenes : [];

  // 2. Scene count
  if (scenes.length < 3 || scenes.length > 6) {
    errors.push(`scene count must be 3-6, got ${scenes.length}`);
  }

  // 3. Subject present — at least one meaningful subject token appears across
  //    the scene descriptions / asset prompts (anti-drift).
  const tokens = subjectTokens(userText);
  if (tokens.length) {
    const haystack = scenes
      .map((s) => `${s.description || ""} ${s.asset?.prompt || ""}`.toLowerCase())
      .join(" ");
    const anchored = tokens.some((t) => haystack.includes(t));
    if (!anchored) errors.push("no scene references the user's subject (content drift)");
  }

  for (const s of scenes) {
    // 4. Overlay types
    for (const ov of s.overlays || []) {
      if (!OVERLAY_TYPES.has(ov.type)) errors.push(`scene ${s.id}: unknown overlay type "${ov.type}"`);
    }
    // 5. Scrim on text
    if ((s.overlays || []).length && (s.background?.scrim ?? 0) < 0.3) {
      errors.push(`scene ${s.id}: text overlay needs background.scrim >= 0.3`);
    }
    // 6. Duration sanity (only for generated footage)
    const generates = s.background?.kind === "video" && s.background?.source === "generate";
    if (generates && (s.durationSeconds || 0) > PROVIDER_MAX_SECONDS) {
      errors.push(`scene ${s.id}: durationSeconds ${s.durationSeconds} exceeds provider max ${PROVIDER_MAX_SECONDS}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Produce a validated scenePlan from a user description. Retries with the
 * validation errors fed back to the model.
 *
 * @param {string} userText
 * @param {{ premium?: boolean, maxAttempts?: number }} [opts]
 * @returns {Promise<object>} the validated scenePlan
 */
export async function planScenes(userText, { premium = false, maxAttempts = 3 } = {}) {
  let lastErrors = [];
  let user = userText;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (lastErrors.length) {
      user = `${userText}\n\nYour previous plan was rejected for these reasons:\n- ${lastErrors.join("\n- ")}\nReturn a corrected scenePlan JSON only.`;
    }
    const raw = await callLLM({ system: SCENE_PLANNER_SYSTEM_PROMPT, user, premium, maxTokens: 4000 });
    const plan = extractJson(raw);
    if (!plan) {
      lastErrors = ["output was not valid JSON"];
      continue;
    }
    const { ok, errors } = validateScenePlan(plan, userText);
    if (ok) return plan;
    lastErrors = errors;
  }

  throw new Error(`Scene plan failed validation after ${maxAttempts} attempts:\n- ${lastErrors.join("\n- ")}`);
}
