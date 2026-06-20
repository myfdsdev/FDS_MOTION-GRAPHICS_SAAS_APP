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
import { composeScenePlannerSystem } from "../prompts/scenePlanner.js";
import { pickRecipe, getRecipe } from "./recipes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, "../../schemas/scene_plan.schema.json");

const OVERLAY_TYPES = new Set([
  "heroTitle", "kineticTitle", "sectionTitle", "textCard", "statCard", "statReveal",
  "calloutBox", "comparisonCard", "progressBar", "providerChip",
  "barChart", "lineChart", "pieChart", "kpiGrid", "particles",
]);

// Per-model max clip length (seconds). Kie Kling 2.6 defaults to 5-second
// clips, so keep generated scenes inside that unless explicitly overridden.
const PROVIDER_MAX_SECONDS = Number(process.env.GEN_MAX_CLIP_SECONDS || 5);

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

function validObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function validAudioTrack(value) {
  return validObject(value) && typeof value.src === "string" && value.src.trim().length > 0;
}

// Narration is valid if it has a real src OR a spoken script (which the worker
// synthesizes to audio before render).
function validNarration(value) {
  if (!validObject(value)) return false;
  if (typeof value.src === "string" && value.src.trim()) return true;
  return typeof value.script === "string" && value.script.trim().length > 0;
}

/**
 * Fix harmless model drift before schema validation. Optional media fields
 * should be omitted when unused, but LLMs often emit null/[]/"none" there.
 */
export function normalizeScenePlan(plan) {
  if (!validObject(plan)) return plan;

  const normalized = structuredClone(plan);

  if (!validNarration(normalized.narration)) delete normalized.narration;
  if (!validAudioTrack(normalized.music)) delete normalized.music;

  if (Array.isArray(normalized.captions)) {
    normalized.captions = { words: normalized.captions };
  }
  if (!validObject(normalized.captions) || !Array.isArray(normalized.captions.words)) {
    delete normalized.captions;
  }

  return normalized;
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
    // 5. Scrim on text — only required when text sits on FOOTAGE/IMAGE. Flat
    //    color backgrounds (graphics recipes) are already legible, so we don't
    //    force them to darken.
    const overFootage = s.background?.kind === "video" || s.background?.kind === "image";
    if (overFootage && (s.overlays || []).length && (s.background?.scrim ?? 0) < 0.3) {
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
 * The `recipe` option steers which video TYPE the planner produces (cinematic
 * ad, data explainer, kinetic typography, product showcase, social short). Pass
 * a recipe id to force one, "auto" (default) to pick from the prompt text, or
 * null to use the plain base prompt.
 *
 * @param {string} userText
 * @param {{ premium?: boolean, maxAttempts?: number, recipe?: string|null, aspectRatio?: string }} [opts]
 * @returns {Promise<object>} the validated scenePlan (with `recipeId` attached)
 */
export async function planScenes(userText, { premium = false, maxAttempts = 3, recipe = "auto", aspectRatio } = {}) {
  // Resolve the recipe once. "auto" => deterministic keyword pick; an id =>
  // that recipe; null/false => base prompt (recipe disabled).
  let chosen = null;
  if (recipe === "auto") chosen = pickRecipe(userText, { aspectRatio });
  else if (recipe) chosen = getRecipe(recipe);
  const system = composeScenePlannerSystem(chosen);

  let lastErrors = [];
  let user = userText;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (lastErrors.length) {
      user = `${userText}\n\nYour previous plan was rejected for these reasons:\n- ${lastErrors.join("\n- ")}\nReturn a corrected scenePlan JSON only.`;
    }
    const raw = await callLLM({ system, user, premium, maxTokens: 4000 });
    const plan = extractJson(raw);
    if (!plan) {
      lastErrors = ["output was not valid JSON"];
      continue;
    }
    const normalizedPlan = normalizeScenePlan(plan);
    const { ok, errors } = validateScenePlan(normalizedPlan, userText);
    if (ok) {
      if (chosen) normalizedPlan.recipeId = chosen.id; // record which archetype was used
      return normalizedPlan;
    }
    lastErrors = errors;
  }

  throw new Error(`Scene plan failed validation after ${maxAttempts} attempts:\n- ${lastErrors.join("\n- ")}`);
}
