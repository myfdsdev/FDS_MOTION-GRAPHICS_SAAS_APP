import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Project, User } from "../models.js";
import { VideoPlanSchema } from "../schemas.js";
import { isStorageConfigured, uploadFile } from "./storage.js";
import {
  estimateVoiceoverDuration,
  isTtsConfigured,
  synthesizeVoiceover,
} from "./tts.js";
import {
  recordApiUsage,
  usageFromGemini,
  usageFromOpenAI,
} from "./apiUsage.js";
import { costForDuration, refundCredits } from "./credits.js";
import {
  assertKnownLottieAssets,
  listLottieAssetSummaries,
  lottieAssetPromptListFromSummaries,
} from "./lottieLibrary.js";
import { decryptSecret } from "./secrets.js";
import { getAppSettings } from "./settings.js";
import { SCENE_TEMPLATES, VIDEO_CATEGORIES } from "./videoAssets.js";
import { getAvoidanceHints, recordVideoSignature } from "./variety.js";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

const animations = [
  "fade-in",
  "fade-out",
  "slide-left",
  "slide-right",
  "slide-up",
  "zoom-in",
  "zoom-out",
  "pop-up",
  "blur-reveal",
  "typewriter",
  "fast-zoom",
  "camera-push",
];

const transitions = ["cut", "quick-slide", "zoom-cut", "fade", "blur"];

const templates = [
  "saas-product-promo",
  "app-launch",
  "explainer-video",
  "social-reel",
  "local-business",
];

function createGeneratedPayloadSchema(lottieAssetIds) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["script", "plan"],
    properties: {
      script: {
        type: "string",
        description: "Four to six short video script lines separated by newlines.",
      },
      plan: {
        type: "object",
        additionalProperties: false,
        required: ["duration", "aspectRatio", "template", "category", "brandColors", "scenes"],
        properties: {
          duration: { type: "number", minimum: 5, maximum: 60 },
          aspectRatio: { type: "string", enum: ["16:9", "9:16", "1:1"] },
          template: { type: "string", enum: templates },
          category: { type: "string", enum: VIDEO_CATEGORIES },
          brandColors: {
            type: "array",
            items: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
            minItems: 1,
            maxItems: 6,
          },
          scenes: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "scene",
                "duration",
                "text",
                "headline",
                "subtext",
                "visual",
                "sceneTemplate",
                "animation",
                "transition",
              ],
              properties: {
                scene: { type: "integer", minimum: 1 },
                duration: { type: "number", minimum: 1, maximum: 15 },
                text: { type: "string", maxLength: 140 },
                headline: { type: "string", maxLength: 90 },
                subtext: { type: "string", maxLength: 160 },
                visual: { type: "string" },
                sceneTemplate: { type: "string", enum: SCENE_TEMPLATES },
                animation: { type: "string", enum: animations },
                transition: { type: "string", enum: transitions },
              },
            },
          },
        },
      },
    },
  };
}

// Gemini's responseSchema uses a restricted OpenAPI subset (uppercase TYPE,
// no additionalProperties/pattern/min-max). Enforcing it forces the exact
// field names + enums so the response matches VideoPlanSchema.
function createGeminiResponseSchema(lottieAssetIds) {
  return {
    type: "OBJECT",
    properties: {
      script: { type: "STRING" },
      plan: {
        type: "OBJECT",
        properties: {
          duration: { type: "NUMBER" },
          aspectRatio: { type: "STRING", enum: ["16:9", "9:16", "1:1"] },
          template: { type: "STRING", enum: templates },
          category: { type: "STRING", enum: VIDEO_CATEGORIES },
          brandColors: { type: "ARRAY", items: { type: "STRING" } },
          scenes: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                scene: { type: "INTEGER" },
                duration: { type: "NUMBER" },
                text: { type: "STRING" },
                headline: { type: "STRING" },
                subtext: { type: "STRING" },
                visual: { type: "STRING" },
                sceneTemplate: { type: "STRING", enum: SCENE_TEMPLATES },
                animation: { type: "STRING", enum: animations },
                transition: { type: "STRING", enum: transitions },
              },
              required: [
                "scene",
                "duration",
                "text",
                "headline",
                "subtext",
                "visual",
                "sceneTemplate",
                "animation",
                "transition",
              ],
            },
          },
        },
        required: ["duration", "aspectRatio", "template", "category", "brandColors", "scenes"],
      },
    },
    required: ["script", "plan"],
  };
}

async function resolveAiConfig(userId) {
  const settings = await getAppSettings();
  const user = settings.allowUserApiKeys && userId ? await User.findById(userId).lean() : null;
  const userOpenAI = decryptSecret(user?.apiKeys?.openai);
  const userGemini = decryptSecret(user?.apiKeys?.gemini);

  if (userOpenAI || process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: userOpenAI || process.env.OPENAI_API_KEY,
      keySource: userOpenAI ? "user" : "environment",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    };
  }

  if (userGemini || process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      apiKey: userGemini || process.env.GEMINI_API_KEY,
      keySource: userGemini ? "user" : "environment",
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    };
  }

  return null;
}

export async function getAiProvider(userId) {
  const config = await resolveAiConfig(userId);
  if (config) return config.provider;
  return null;
}

export async function generationConfigError(userId) {
  if (!(await resolveAiConfig(userId))) {
    return "AI generation is not configured. Add an API key in Profile or set OPENAI_API_KEY/GEMINI_API_KEY in backend/.env.";
  }
  return null;
}

function systemPrompt(durationSec, lottieAssetPrompt, avoidance) {
  const lines = [
    "You are a motion-graphics director for a SaaS video generator.",
    "Return only valid JSON that matches the requested schema.",
    `Create a ${durationSec}-second video plan from the user's prompt.`,
    "Use 3 to 5 scenes. Each scene text must be short and suitable for on-screen typography.",
    `Available templates: ${templates.join(", ")}.`,
    `Available video categories: ${VIDEO_CATEGORIES.join(", ")}.`,
    `Available scene templates: ${SCENE_TEMPLATES.join(", ")}.`,
    `Available animations: ${animations.join(", ")}.`,
    `Available transitions: ${transitions.join(", ")}.`,
    "For every scene, choose one sceneTemplate from the allowed list.",
    "VARY the sceneTemplate across scenes — do NOT use the same template for every scene. Prefer 'kinetic-title' or 'animated-bg-text' for openers, 'final-cta' for closers, and mix 'app-showcase' / 'offer-burst' / 'proof-cards' for the middle. In a 3+ scene plan no template should repeat back-to-back, and the same template should not appear in more than half the scenes.",
    "Favor modern ad motion: white kinetic typography, animated dark backgrounds, glowing accent shapes, punchy offer reveals, and clear app/product callouts.",
    "No placeholder copy like [Brand Name], Company Name, your brand, or example.com.",
    "No labels inside the script. No markdown.",
  ];

  // Anti-repetition: tell the model what this user has already seen recently
  // so we don't keep producing the same structural fingerprint for power users.
  if (avoidance && (avoidance.templates?.length || avoidance.sequences?.length)) {
    const parts = [];
    if (avoidance.templates?.length) {
      parts.push(
        `This user has used these templates a lot recently — AVOID them: ${avoidance.templates.join(", ")}.`
      );
    }
    if (avoidance.sequences?.length) {
      parts.push(
        `Do NOT reuse these recent scene-template sequences: ${avoidance.sequences.map((s) => `"${s}"`).join("; ")}.`
      );
    }
    parts.push(
      "Pick a deliberately different structural shape than the recent sequences — different opener, different middle pattern, different closer if possible."
    );
    lines.push(parts.join(" "));
  }

  return lines.join(" ");
}

function parseModelJson(raw) {
  if (!raw || typeof raw !== "string") throw new Error("AI returned an empty response");
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed);
}

async function readErrorBody(res) {
  const text = await res.text().catch(() => "");
  if (!text) return "";
  try {
    const json = JSON.parse(text);
    return json.error?.message || json.message || text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

// Retry transient AI failures (5xx, 429, brief network/parse hiccups) with
// exponential backoff + jitter. 4xx auth/validation errors are NOT retried —
// hammering won't fix them and wastes quota.
async function withRetry(fn, attempts = 5, baseDelay = 1500) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Bail early on permanent client errors (401/403/404/etc.) but not 429.
      const m = msg.match(/\((\d{3})\)/);
      const code = m ? Number(m[1]) : null;
      const retryable = !code || code >= 500 || code === 429 || code === 408;
      if (!retryable || i >= attempts - 1) break;
      // Exponential backoff: 1.5s, 3s, 6s, 12s with ±30% jitter.
      const delay = Math.round(baseDelay * Math.pow(2, i) * (0.7 + Math.random() * 0.6));
      console.warn(`[pipeline] retry ${i + 1}/${attempts - 1} after ${delay}ms (${code ?? "?"})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function generateWithOpenAI(
  prompt,
  durationSec,
  config,
  userId,
  purpose,
  lottieAssetIds,
  lottieAssetPrompt,
  avoidance
) {
  const res = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt(durationSec, lottieAssetPrompt, avoidance) },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "motion_video_generation",
          strict: true,
          schema: createGeneratedPayloadSchema(lottieAssetIds),
        },
      },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI generation failed (${res.status}): ${await readErrorBody(res)}`);
  }

  const data = await res.json();
  await recordApiUsage({
    userId,
    config,
    purpose,
    usage: usageFromOpenAI(data.usage),
  });
  return parseModelJson(data.choices?.[0]?.message?.content);
}

async function generateWithGemini(
  prompt,
  durationSec,
  config,
  userId,
  purpose,
  lottieAssetIds,
  lottieAssetPrompt,
  avoidance
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt(durationSec, lottieAssetPrompt, avoidance)}\n\nReturn this JSON shape: {"script":"...","plan":{...}}.\n\nPrompt: ${prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: createGeminiResponseSchema(lottieAssetIds),
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini generation failed (${res.status}): ${await readErrorBody(res)}`);
  }

  const data = await res.json();
  await recordApiUsage({
    userId,
    config,
    purpose,
    usage: usageFromGemini(data.usageMetadata),
  });
  return parseModelJson(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

export async function enhancePromptWithAi(prompt, userId) {
  const config = await resolveAiConfig(userId);
  if (!config) throw new Error(await generationConfigError(userId));

  if (config.provider === "openai") {
    const res = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content:
              "Rewrite the user's idea as a concise, production-ready motion graphics prompt. Keep it under 120 words. Return plain text only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 220,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI prompt enhancement failed (${res.status}): ${await readErrorBody(res)}`);
    }

    const data = await res.json();
    await recordApiUsage({
      userId,
      config,
      purpose: "prompt_enhancement",
      usage: usageFromOpenAI(data.usage),
    });
    const enhanced = data.choices?.[0]?.message?.content?.trim();
    if (!enhanced) throw new Error("AI returned an empty enhanced prompt");
    return enhanced;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Rewrite this as a concise, production-ready motion graphics prompt under 120 words. Return plain text only.\n\n${prompt}`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini prompt enhancement failed (${res.status}): ${await readErrorBody(res)}`);
  }

  const data = await res.json();
  await recordApiUsage({
    userId,
    config,
    purpose: "prompt_enhancement",
    usage: usageFromGemini(data.usageMetadata),
  });
  const enhanced = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!enhanced) throw new Error("AI returned an empty enhanced prompt");
  return enhanced;
}

// Tidy minor model drift before strict Zod validation: keep only valid hex
// brand colors, clamp scene durations to 1-15s, cap scenes at 6, and renumber.
function sanitizePlan(plan) {
  if (!plan || typeof plan !== "object") return plan;
  const out = { ...plan };

  if (Array.isArray(out.brandColors)) {
    const hex = out.brandColors.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
    if (hex.length) out.brandColors = hex.slice(0, 6);
    else delete out.brandColors; // optional in the schema — fall back to defaults
  }

  if (Array.isArray(out.scenes)) {
    out.scenes = out.scenes.slice(0, 6).map((s, i) => ({
      ...s,
      scene: Number.isInteger(s?.scene) && s.scene > 0 ? s.scene : i + 1,
      duration: Math.min(15, Math.max(1, Number(s?.duration) || 4)),
      headline: s?.headline || s?.text || "",
      subtext: s?.subtext || s?.visual || "",
    }));
  }

  return out;
}

function assertNoPlaceholders(plan) {
  const raw = JSON.stringify(plan).toLowerCase();
  const blocked = ["[brand", "brand name", "company name", "your brand", "example.com"];
  const match = blocked.find((term) => raw.includes(term));
  if (match) throw new Error(`AI response included placeholder copy: ${match}`);
}

async function generateVideoPlan(prompt, durationSec, userId) {
  const config = await resolveAiConfig(userId);
  if (!config) throw new Error(await generationConfigError(userId));

  const lottieAssets = await listLottieAssetSummaries();
  const lottieAssetIds = lottieAssets.map((asset) => asset.id);
  const lottieAssetPrompt = lottieAssetPromptListFromSummaries(lottieAssets);

  // Pull recent structural signatures for this user so the AI knows what
  // NOT to repeat. Power-user variety lives here.
  const avoidance = await getAvoidanceHints(userId).catch(() => null);

  const payload = await withRetry(() =>
    config.provider === "openai"
      ? generateWithOpenAI(
          prompt,
          durationSec,
          config,
          userId,
          "video_generation",
          lottieAssetIds,
          lottieAssetPrompt,
          avoidance
        )
      : generateWithGemini(
          prompt,
          durationSec,
          config,
          userId,
          "video_generation",
          lottieAssetIds,
          lottieAssetPrompt,
          avoidance
        )
  );

  if (!payload || typeof payload.script !== "string") {
    throw new Error("AI response did not include a script");
  }

  const plan = sanitizePlan(payload.plan);
  assertNoPlaceholders(plan);
  // Lottie assets are no longer assigned by the AI — admins upload Lotties for
  // optional manual placement on the canvas, but generation produces none.
  const parsed = VideoPlanSchema.safeParse(plan);
  if (!parsed.success) {
    throw new Error(`AI response did not match the video schema: ${parsed.error.message}`);
  }

  return {
    script: payload.script.trim(),
    plan: parsed.data,
  };
}

// Save generated narration using the same path/bucket pattern as rendered MP4s:
// written to backend/public/videos/<id>.<ext> when local and uploaded to
// voiceovers/<id>.<ext> when object storage is on.
const __PIPELINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const VOICEOVERS_LOCAL_DIR = path.join(__PIPELINE_DIR, "..", "..", "public", "videos");
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function persistVoiceover(projectId, audio, script) {
  const buffer = Buffer.isBuffer(audio) ? audio : audio?.buffer;
  if (!buffer) throw new Error("Voiceover audio payload is empty");
  const extension = String(audio?.extension || "mp3").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const contentType = audio?.contentType || (extension === "wav" ? "audio/wav" : "audio/mpeg");

  fs.mkdirSync(VOICEOVERS_LOCAL_DIR, { recursive: true });
  const localPath = path.join(VOICEOVERS_LOCAL_DIR, `${projectId}.${extension}`);
  await fs.promises.writeFile(localPath, buffer);

  let url = `${PUBLIC_BASE}/videos/${projectId}.${extension}`;
  if (isStorageConfigured()) {
    url = await uploadFile(localPath, `voiceovers/${projectId}.${extension}`, contentType);
    await fs.promises.rm(localPath, { force: true }).catch(() => {});
  }
  return { url, duration: estimateVoiceoverDuration(script) };
}

// Fire-and-forget pipeline. It never creates placeholder videos. If AI or the
// real renderer is unavailable, the project fails and credits are refunded.
export async function runPipeline(projectId, userId, prompt, durationSec) {
  const cost = costForDuration(durationSec);

  try {
    await Project.updateOne(
      { _id: projectId },
      { status: "GENERATING_ASSETS", progress: 10, errorMessage: null }
    );

    const { script, plan } = await generateVideoPlan(prompt, durationSec, userId);

    // Voiceover is additive — TTS failure (or missing key) must NEVER fail the
    // project. We try, swallow errors, and continue to READY_TO_EDIT. A short
    // reason is captured on the project so the editor can surface "Narration
    // unavailable" instead of silently producing a silent video.
    let voiceoverUrl = null;
    let voiceoverDuration = null;
    let voiceoverError = null;
    if (!script || !script.trim()) {
      voiceoverError = "empty_script";
    } else if (!isTtsConfigured()) {
      voiceoverError = "missing_piper_script";
    } else {
      try {
        const audio = await synthesizeVoiceover(script);
        const audioSize = Buffer.isBuffer(audio) ? audio.length : audio?.buffer?.length;
        if (!audioSize || audioSize < 44) {
          voiceoverError = "empty_response";
        } else {
          const { url, duration } = await persistVoiceover(projectId, audio, script);
          voiceoverUrl = url;
          voiceoverDuration = duration;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Keep the reason short and safe — no API key or full request body.
        const m = msg.match(/\((\d{3})\)/);
        voiceoverError = m ? `http_${m[1]}` : msg.slice(0, 80);
        console.warn(`[pipeline] voiceover failed for ${projectId}: ${voiceoverError}`);
      }
    }
    // Surface non-fatal voiceover failures into the structured warnings list
    // so the UI can show the root cause alongside "Narration unavailable".
    if (voiceoverError) {
      await Project.updateOne(
        { _id: projectId },
        {
          $push: {
            warnings: {
              $each: [
                {
                  phase: "tts",
                  message: `Voiceover skipped: ${voiceoverError}`,
                  at: new Date(),
                },
              ],
              $slice: -10,
            },
          },
        }
      ).catch(() => {});
    }

    await Project.updateOne(
      { _id: projectId },
      {
        // Stop here so the user can edit on the canvas. The render worker only
        // claims "QUEUED" — rendering happens when the user clicks Render
        // (POST /:id/rerender), which transitions READY_TO_EDIT → QUEUED.
        status: "READY_TO_EDIT",
        progress: 30,
        script,
        sceneJson: plan,
        template: plan.template,
        aspectRatio: plan.aspectRatio,
        voiceoverUrl,
        voiceoverDuration,
        voiceoverError,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pipeline error";
    const code = err instanceof Error ? err.code || err.name || null : null;
    const stack = err instanceof Error ? err.stack || null : null;
    console.error(`[pipeline] project ${projectId} failed:`, err);
    await Project.updateOne(
      { _id: projectId },
      {
        status: "FAILED",
        progress: 0,
        errorMessage: message,
        errorPhase: "ai",
        errorCode: code,
        errorStack: stack,
        errorAt: new Date(),
        outputUrl: null,
        thumbnailUrl: null,
      }
    );
    await refundCredits(userId, cost, projectId).catch((refundErr) => {
      console.error(`[pipeline] credit refund failed for ${projectId}:`, refundErr);
    });
  }
}
