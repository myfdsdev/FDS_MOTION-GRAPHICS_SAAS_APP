import { Project, User } from "../models.js";
import { VideoPlanSchema } from "../schemas.js";
import {
  recordApiUsage,
  usageFromGemini,
  usageFromOpenAI,
} from "./apiUsage.js";
import { costForDuration, refundCredits } from "./credits.js";
import { decryptSecret } from "./secrets.js";

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

const generatedPayloadSchema = {
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
      required: ["duration", "aspectRatio", "template", "brandColors", "scenes"],
      properties: {
        duration: { type: "number", minimum: 5, maximum: 60 },
        aspectRatio: { type: "string", enum: ["16:9", "9:16", "1:1"] },
        template: { type: "string", enum: templates },
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
            required: ["scene", "duration", "text", "visual", "animation", "transition"],
            properties: {
              scene: { type: "integer", minimum: 1 },
              duration: { type: "number", minimum: 1, maximum: 15 },
              text: { type: "string", maxLength: 140 },
              visual: { type: "string" },
              animation: { type: "string", enum: animations },
              transition: { type: "string", enum: transitions },
            },
          },
        },
      },
    },
  },
};

// Gemini's responseSchema uses a restricted OpenAPI subset (uppercase TYPE,
// no additionalProperties/pattern/min-max). Enforcing it forces the exact
// field names + enums so the response matches VideoPlanSchema.
const geminiResponseSchema = {
  type: "OBJECT",
  properties: {
    script: { type: "STRING" },
    plan: {
      type: "OBJECT",
      properties: {
        duration: { type: "NUMBER" },
        aspectRatio: { type: "STRING", enum: ["16:9", "9:16", "1:1"] },
        template: { type: "STRING", enum: templates },
        brandColors: { type: "ARRAY", items: { type: "STRING" } },
        scenes: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              scene: { type: "INTEGER" },
              duration: { type: "NUMBER" },
              text: { type: "STRING" },
              visual: { type: "STRING" },
              animation: { type: "STRING", enum: animations },
              transition: { type: "STRING", enum: transitions },
            },
            required: ["scene", "duration", "text", "visual", "animation", "transition"],
          },
        },
      },
      required: ["duration", "aspectRatio", "template", "brandColors", "scenes"],
    },
  },
  required: ["script", "plan"],
};

async function resolveAiConfig(userId) {
  const user = userId ? await User.findById(userId).lean() : null;
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

function systemPrompt(durationSec) {
  return [
    "You are a motion-graphics director for a SaaS video generator.",
    "Return only valid JSON that matches the requested schema.",
    `Create a ${durationSec}-second video plan from the user's prompt.`,
    "Use 3 to 5 scenes. Each scene text must be short and suitable for on-screen typography.",
    `Available templates: ${templates.join(", ")}.`,
    `Available animations: ${animations.join(", ")}.`,
    `Available transitions: ${transitions.join(", ")}.`,
    "No placeholder copy. No labels inside the script. No markdown.",
  ].join(" ");
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

// Retry transient AI failures (5xx, brief network/parse hiccups) with backoff.
async function withRetry(fn, attempts = 3, baseDelay = 700) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelay * (i + 1)));
    }
  }
  throw lastErr;
}

async function generateWithOpenAI(prompt, durationSec, config, userId, purpose) {
  const res = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt(durationSec) },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "motion_video_generation",
          strict: true,
          schema: generatedPayloadSchema,
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

async function generateWithGemini(prompt, durationSec, config, userId, purpose) {
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
              text: `${systemPrompt(durationSec)}\n\nReturn this JSON shape: {"script":"...","plan":{...}}.\n\nPrompt: ${prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: geminiResponseSchema,
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
    }));
  }

  return out;
}

async function generateVideoPlan(prompt, durationSec, userId) {
  const config = await resolveAiConfig(userId);
  if (!config) throw new Error(await generationConfigError(userId));

  const payload = await withRetry(() =>
    config.provider === "openai"
      ? generateWithOpenAI(prompt, durationSec, config, userId, "video_generation")
      : generateWithGemini(prompt, durationSec, config, userId, "video_generation")
  );

  if (!payload || typeof payload.script !== "string") {
    throw new Error("AI response did not include a script");
  }

  const plan = sanitizePlan(payload.plan);
  const parsed = VideoPlanSchema.safeParse(plan);
  if (!parsed.success) {
    throw new Error(`AI response did not match the video schema: ${parsed.error.message}`);
  }

  return {
    script: payload.script.trim(),
    plan: parsed.data,
  };
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

    await Project.updateOne(
      { _id: projectId },
      {
        status: "QUEUED",
        progress: 30,
        script,
        sceneJson: plan,
        template: plan.template,
        aspectRatio: plan.aspectRatio,
      }
    );

    // The render worker (worker.js) picks up QUEUED projects and produces the MP4.
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pipeline error";
    console.error(`[pipeline] project ${projectId} failed:`, err);
    await Project.updateOne(
      { _id: projectId },
      {
        status: "FAILED",
        progress: 0,
        errorMessage: message,
        outputUrl: null,
        thumbnailUrl: null,
      }
    );
    await refundCredits(userId, cost, projectId).catch((refundErr) => {
      console.error(`[pipeline] credit refund failed for ${projectId}:`, refundErr);
    });
  }
}
