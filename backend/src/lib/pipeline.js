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
import { decryptSecret } from "./secrets.js";
import { getAppSettings } from "./settings.js";
// variety.js retained on disk for future use but no longer imported.

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

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


/**
 * Returns a prioritised list of all configured AI providers. The first entry
 * is the primary; the rest are fallbacks tried on 429/503 rate-limit errors.
 */
async function resolveAllAiConfigs(userId) {
  const settings = await getAppSettings();
  const user = settings.allowUserApiKeys && userId ? await User.findById(userId).lean() : null;
  const userOpenAI = decryptSecret(user?.apiKeys?.openai);
  const userGemini = decryptSecret(user?.apiKeys?.gemini);
  const userOpenRouter = decryptSecret(user?.apiKeys?.openrouter);

  const configs = [];

  if (userOpenRouter || process.env.OPENROUTER_API_KEY) {
    configs.push({
      provider: "openrouter",
      apiKey: userOpenRouter || process.env.OPENROUTER_API_KEY,
      keySource: userOpenRouter ? "user" : "environment",
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
    });
  }

  if (userOpenAI || process.env.OPENAI_API_KEY) {
    configs.push({
      provider: "openai",
      apiKey: userOpenAI || process.env.OPENAI_API_KEY,
      keySource: userOpenAI ? "user" : "environment",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    });
  }

  if (userGemini || process.env.GEMINI_API_KEY) {
    configs.push({
      provider: "gemini",
      apiKey: userGemini || process.env.GEMINI_API_KEY,
      keySource: userGemini ? "user" : "environment",
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    });
  }

  return configs;
}

/** Backwards-compat: returns the primary (first) provider config or null. */
async function resolveAiConfig(userId) {
  const configs = await resolveAllAiConfigs(userId);
  return configs[0] ?? null;
}

export async function getAiProvider(userId) {
  const config = await resolveAiConfig(userId);
  if (config) return config.provider;
  return null;
}

export async function generationConfigError(userId) {
  if (!(await resolveAiConfig(userId))) {
    return "AI generation is not configured. Add an API key in Profile or set OPENROUTER_API_KEY/OPENAI_API_KEY/GEMINI_API_KEY in backend/.env.";
  }
  return null;
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


function plainNarrationSystemPrompt(durationSec) {
  const targetWords = Math.round(durationSec * 2.5);
  const minWords = Math.round(durationSec * 2.2);
  const maxWords = Math.round(durationSec * 2.8);
  return [
    "You write narration for a minimal text-only video.",
    "Return plain text only.",
    "Do not return JSON.",
    "Do not return markdown.",
    "Do not return bullet points, scene labels, headings, code, or quoted strings.",
    `Write one natural voiceover for a ${durationSec}-second video.`,
    `Target ${targetWords} words. Acceptable range ${minWords}-${maxWords} words.`,
    "Use short clear sentences. Address the viewer as you. End with a simple next step.",
  ].join(" ");
}

async function generatePlainScriptWithOpenAI(prompt, durationSec, config, userId, purpose, referenceImage) {
  const userContent = referenceImage
    ? [
        {
          type: "text",
          text: `${prompt}\n\nReference image is attached. Use it only to understand tone and topic. Return narration text only.`,
        },
        {
          type: "image_url",
          image_url: { url: referenceImage, detail: "high" },
        },
      ]
    : prompt;

  const isOpenRouter = config.provider === "openrouter";
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  if (isOpenRouter) {
    headers["HTTP-Referer"] = process.env.WEB_ORIGIN || "http://localhost:5173";
    headers["X-Title"] = "AI Video Generator";
  }

  const res = await fetch(isOpenRouter ? OPENROUTER_CHAT_URL : OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: plainNarrationSystemPrompt(durationSec) },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    throw new Error(`${isOpenRouter ? "OpenRouter" : "OpenAI"} generation failed (${res.status}): ${await readErrorBody(res)}`);
  }

  const data = await res.json();
  await recordApiUsage({
    userId,
    config,
    purpose,
    usage: usageFromOpenAI(data.usage),
  });
  return cleanPlainScript(data.choices?.[0]?.message?.content);
}

async function generatePlainScriptWithGemini(prompt, durationSec, config, userId, purpose, referenceImage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const parts = [];
  let textPrompt = `${plainNarrationSystemPrompt(durationSec)}\n\nUser prompt: ${prompt}`;
  if (referenceImage) {
    textPrompt += "\n\nReference image is attached. Use it only to understand tone and topic. Return narration text only.";
    const match = referenceImage.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match) {
      parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
    }
  }
  parts.unshift({ text: textPrompt });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.7 },
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
  return cleanPlainScript(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

function cleanPlainScript(raw) {
  if (!raw || typeof raw !== "string") throw new Error("AI returned an empty script");
  let text = raw.trim();
  const fenceMatch = text.match(/^```(?:text|txt|md)?\s*([\s\S]*?)```$/i);
  if (fenceMatch) text = fenceMatch[1].trim();
  if (text.startsWith("{") && text.endsWith("}")) {
    throw new Error("AI returned JSON, but plain narration text is required");
  }
  text = text
    .replace(/^narration\s*:\s*/i, "")
    .replace(/^voiceover\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) throw new Error("AI returned an empty script");
  return text;
}

const ENHANCE_SYSTEM_PROMPT = `You help write simple text-only video narration. Transform the user's rough idea into a clean, production-ready narration brief. Return plain text only, under 160 words.

YOUR OUTPUT MUST INCLUDE ALL OF THESE:

1. VIDEO CONCEPT - One punchy sentence describing the video's purpose and audience.

2. TEXT STYLE - Specify headline tone, subtitle tone, and solid dark background only.

3. SCENE BREAKDOWN - 3-5 scenes, each with headline text, subtitle text, and narration purpose.

4. PACING - Describe whether the video should feel calm, direct, or urgent.

5. NARRATION TONE - Speaking style for the voiceover: conversational, authoritative, playful, data-driven, etc.

Do not mention visual assets or graphical elements. Be specific. Reference the actual product/topic from the user's input.`;


async function _enhanceWithConfig(prompt, config, userId) {
  if (config.provider === "openai" || config.provider === "openrouter") {
    const isOR = config.provider === "openrouter";
    const headers = {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    };
    if (isOR) {
      headers["HTTP-Referer"] = process.env.WEB_ORIGIN || "http://localhost:5173";
      headers["X-Title"] = "AI Video Generator";
    }

    const res = await fetch(isOR ? OPENROUTER_CHAT_URL : OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: ENHANCE_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      throw new Error(`${isOR ? "OpenRouter" : "OpenAI"} prompt enhancement failed (${res.status}): ${await readErrorBody(res)}`);
    }

    const data = await res.json();
    await recordApiUsage({ userId, config, purpose: "prompt_enhancement", usage: usageFromOpenAI(data.usage) });
    const enhanced = data.choices?.[0]?.message?.content?.trim();
    if (!enhanced) throw new Error("AI returned an empty enhanced prompt");
    return enhanced;
  }

  // Gemini
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${ENHANCE_SYSTEM_PROMPT}\n\nUser's idea: ${prompt}` }] }],
      generationConfig: { temperature: 0.8 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini prompt enhancement failed (${res.status}): ${await readErrorBody(res)}`);
  }

  const data = await res.json();
  await recordApiUsage({ userId, config, purpose: "prompt_enhancement", usage: usageFromGemini(data.usageMetadata) });
  const enhanced = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!enhanced) throw new Error("AI returned an empty enhanced prompt");
  return enhanced;
}

export async function enhancePromptWithAi(prompt, userId) {
  const configs = await resolveAllAiConfigs(userId);
  if (!configs.length) throw new Error(await generationConfigError(userId));

  let lastErr;
  for (const config of configs) {
    try {
      return await _enhanceWithConfig(prompt, config, userId);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Only fallback on rate-limit (429) or overload (503) errors
      if (/\(429\)|\(503\)/.test(msg) && configs.length > 1) {
        console.warn(`[pipeline] ${config.provider} rate-limited, falling back to next provider…`);
        continue;
      }
      throw err; // Non-retryable error — don't fallback
    }
  }
  throw lastErr;
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

  // Safe truncation helper — trim to max chars and append an ellipsis only
  // if we actually had to cut. Used to keep AI overruns from blowing up Zod.
  const truncate = (s, max) => {
    if (typeof s !== "string") return s;
    if (s.length <= max) return s;
    return s.slice(0, max - 1).trimEnd() + "…";
  };

  if (Array.isArray(out.scenes)) {
    out.scenes = out.scenes.slice(0, 6).map((s, i) => {
      const scene = {
        ...s,
        scene: Number.isInteger(s?.scene) && s.scene > 0 ? s.scene : i + 1,
        duration: Math.min(15, Math.max(1, Number(s?.duration) || 4)),
        text: truncate(s?.text ?? "", 800),
        headline: truncate(s?.headline ?? "", 140),
        subtext: truncate(s?.subtext ?? "", 240),
        visual: truncate(s?.visual ?? "", 800),
        sceneTheme: s?.sceneTheme || s?.sceneTemplate || "plain-dark",
      };

      // Minimal mode: no graphical components. Drop any elements the model
      // sends so the renderer stays text-only.
      delete scene.elements;

      return scene;
    });
  }

  return out;
}


function firstWords(value, count) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, count)
    .join(" ");
}

function assertNoPlaceholders(plan) {
  const raw = JSON.stringify(plan).toLowerCase();
  const blocked = ["[brand", "brand name", "company name", "your brand", "example.com"];
  const match = blocked.find((term) => raw.includes(term));
  if (match) throw new Error(`AI response included placeholder copy: ${match}`);
}

// Light client-side quality checks. The AI is told to follow these rules in
// the system prompt; this catches the cases where it ignores them. We DON'T
// throw — instead we record warnings on the project so the user can see why
// a render might feel off and we can regenerate if needed.
function gradePlanQuality(plan, script, durationSec) {
  // Quality grading removed — was checking AI judgment (narration timing,
  // banned phrases, headline length, visual density). Kept the function so
  // existing call sites keep working but it returns no warnings now.
  void plan; void script; void durationSec;
  return [];
}

function createPlainTextPlan(prompt, script, durationSec) {
  const totalDuration = Math.max(1, Number(durationSec) || 12);
  const sceneCount = pickPlainSceneCount(totalDuration);
  const chunks = chunkScript(script, sceneCount);
  const durations = splitDuration(totalDuration, chunks.length);
  const promptHeadline = firstWords(prompt, 6) || "Your video";

  return {
    duration: totalDuration,
    aspectRatio: "16:9",
    category: inferCategory(prompt),
    brandColors: ["#050509", "#ffffff"],
    scenes: chunks.map((text, i) => {
      const cleanText = text || script;
      return {
        scene: i + 1,
        duration: durations[i] || Math.max(1, durationSec / chunks.length),
        text: cleanText,
        headline: makeHeadline(cleanText, i, promptHeadline),
        subtext: makeSubtext(cleanText),
        visual: "Plain text on a solid background",
        sceneTheme: "plain-dark",
        animation: i === 0 ? "fade-in" : "slide-up",
        transition: i === chunks.length - 1 ? "fade" : "cut",
      };
    }),
  };
}

function pickPlainSceneCount(durationSec) {
  if (durationSec <= 8) return 2;
  if (durationSec <= 16) return 3;
  if (durationSec <= 28) return 4;
  return 5;
}

function chunkScript(script, sceneCount) {
  const sentences = splitSentences(script);
  if (!sentences.length) return [firstWords(script, 28) || "Your video is ready."];
  const count = Math.max(1, Math.min(sceneCount, sentences.length));
  const chunks = Array.from({ length: count }, () => []);
  sentences.forEach((sentence, index) => {
    const bucket = Math.min(count - 1, Math.floor((index / sentences.length) * count));
    chunks[bucket].push(sentence);
  });
  return chunks.map((items) => items.join(" ").trim()).filter(Boolean);
}

function splitSentences(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitDuration(total, count) {
  const safeCount = Math.max(1, count);
  const base = Math.max(1, Number(total) || safeCount) / safeCount;
  return Array.from({ length: safeCount }, (_, i) => {
    if (i === safeCount - 1) {
      return Math.max(1, Number((total - base * (safeCount - 1)).toFixed(2)));
    }
    return Number(base.toFixed(2));
  });
}

function makeHeadline(text, index, fallback) {
  if (index === 0 && fallback) return trimText(fallback, 60);
  return trimText(firstWords(text, 6), 60) || fallback || "Next step";
}

function makeSubtext(text) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return trimText(words.slice(6, 18).join(" ") || words.slice(0, 12).join(" "), 120);
}

function trimText(value, max) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "...";
}

function inferCategory(prompt) {
  const text = String(prompt || "").toLowerCase();
  if (/\b(saas|software|app|platform|ai|startup)\b/.test(text)) return "saas";
  if (/\b(ad|ads|marketing|campaign|launch|brand)\b/.test(text)) return "marketing";
  if (/\b(shop|store|restaurant|local|salon|gym|food)\b/.test(text)) return "local-business";
  if (/\b(me|my|portfolio|personal)\b/.test(text)) return "personal";
  return "business";
}

async function generateVideoPlan(prompt, durationSec, userId, referenceImage) {
  const configs = await resolveAllAiConfigs(userId);
  if (!configs.length) throw new Error(await generationConfigError(userId));

  let script, lastErr;
  for (const config of configs) {
    try {
      const genFn = config.provider === "openai" || config.provider === "openrouter"
        ? generatePlainScriptWithOpenAI : generatePlainScriptWithGemini;
      script = await withRetry(() =>
        genFn(prompt, durationSec, config, userId, "video_generation", referenceImage)
      );
      break; // success
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/\(429\)|\(503\)/.test(msg) && configs.length > 1) {
        console.warn(`[pipeline] ${config.provider} rate-limited, falling back to next provider…`);
        continue;
      }
      throw err;
    }
  }
  if (!script) throw lastErr;

  const plan = sanitizePlan(createPlainTextPlan(prompt, script, durationSec));
  assertNoPlaceholders(plan);
  const parsed = VideoPlanSchema.safeParse(plan);
  if (!parsed.success) {
    throw new Error(`Generated plain video plan did not match the video schema: ${parsed.error.message}`);
  }

  return {
    script: script.trim(),
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

// Fire-and-forget pipeline. It queues the worker-driven hybrid flow:
// prompt -> scene plan -> generated footage -> SceneRenderer -> MP4.
// If the real renderer or providers are unavailable, the project fails and
// credits are refunded.
export async function runPipeline(projectId, userId, prompt, durationSec) {
  const cost = costForDuration(durationSec);

  try {
    await Project.updateOne(
      { _id: projectId },
      {
        status: "QUEUED",
        progress: 2,
        prompt,
        durationSec,
        componentSource: null,
        brief: null,
        sceneJson: null,
        renderPlan: null,
        outputUrl: null,
        errorMessage: null,
        errorPhase: null,
        errorCode: null,
        errorStack: null,
        errorAt: null,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Queue error";
    const code = err instanceof Error ? err.code || err.name || null : null;
    const stack = err instanceof Error ? err.stack || null : null;
    console.error(`[pipeline] project ${projectId} queue failed:`, err);
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
      }
    );
    await refundCredits(userId, cost, projectId).catch((refundErr) => {
      console.error(`[pipeline] credit refund failed for ${projectId}:`, refundErr);
    });
  }
}
