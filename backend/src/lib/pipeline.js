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

// Allow-list of lucide-react icon names the renderer will reliably draw.
// Keep it broad enough to cover most product/topic vibes but explicit so the
// AI never invents a name the renderer can't resolve.
const ICON_VOCAB = [
  "Sparkles","Zap","Rocket","Clock","Timer","Calendar","Star","Heart",
  "ThumbsUp","Award","Trophy","Target","Lightbulb","TrendingUp","BarChart3",
  "PieChart","LineChart","ShieldCheck","Lock","Unlock","Eye","EyeOff",
  "Users","UserCheck","UserPlus","MessageSquare","Mail","Phone","Bell",
  "Globe","Map","Compass","Smartphone","Monitor","Laptop","Tablet",
  "Camera","Video","Image","Music","Play","Pause","Download","Upload",
  "Share2","Send","Link","Copy","Search","Settings","Wrench","Cog",
  "ShoppingCart","CreditCard","Wallet","DollarSign","Tag","Gift",
  "FileText","Folder","Database","Server","Cloud","Wifi","Bluetooth",
  "Check","CheckCircle2","X","XCircle","Plus","Minus","ArrowRight",
  "ArrowUp","ArrowDown","ArrowLeft","ChevronRight","ChevronUp",
  "Smile","Coffee","Pizza","Briefcase","Building2","Home","Car",
  "Plane","Truck","Calculator","Code","Terminal","Cpu","Bot","Brain",
];

// Element shape used in the structured-output schema. Loose-but-typed: every
// element MUST have a `type` (drives discriminated rendering) plus fractional
// box coordinates (x, y, w, h in 0..1). Optional fields cover the union of
// every element type — Zod tightens this up after parsing. Keeping the schema
// flat (not oneOf-per-type) maximises compatibility with both OpenAI's strict
// JSON Schema and Gemini's restricted subset.
function elementSchemaJson() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["type", "x", "y", "w", "h"],
    properties: {
      type: { type: "string", enum: ["text", "icon", "image", "shape", "bar-chart", "line-chart", "stat", "subtitle"] },
      x: { type: "number", minimum: 0, maximum: 1 },
      y: { type: "number", minimum: 0, maximum: 1 },
      w: { type: "number", minimum: 0.02, maximum: 1 },
      h: { type: "number", minimum: 0.02, maximum: 1 },
      rotation: { type: "number", minimum: -180, maximum: 180 },
      // Text / subtitle
      text: { type: "string", maxLength: 200 },
      color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      size: { type: "number", minimum: 0.02, maximum: 0.4 },
      weight: { type: "integer", minimum: 100, maximum: 900 },
      align: { type: "string", enum: ["left", "center", "right"] },
      // Icon
      name: { type: "string", enum: ICON_VOCAB },
      // Image
      src: { type: "string", maxLength: 600 },
      fit: { type: "string", enum: ["cover", "contain"] },
      // Shape
      shape: { type: "string", enum: ["rect", "ellipse"] },
      fill: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      stroke: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      strokeWidth: { type: "number", minimum: 0, maximum: 24 },
      radius: { type: "number", minimum: 0, maximum: 200 },
      // Bar chart
      title: { type: "string", maxLength: 80 },
      subtitle: { type: "string", maxLength: 200 },
      rows: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "value"],
          properties: {
            label: { type: "string", maxLength: 60 },
            value: { type: "number", minimum: 0, maximum: 100 },
          },
        },
      },
      // Line / growth chart
      points: {
        type: "array",
        minItems: 2,
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["value"],
          properties: {
            label: { type: "string", maxLength: 24 },
            value: { type: "number", minimum: 0, maximum: 10000 },
          },
        },
      },
      line: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      finalValue: { type: "number" },
      finalLabel: { type: "string", maxLength: 40 },
      valuePrefix: { type: "string", maxLength: 8 },
      valueSuffix: { type: "string", maxLength: 8 },
      // Stat tile
      value: { type: "number" },
      label: { type: "string", maxLength: 80 },
      caption: { type: "string", maxLength: 160 },
      accent: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      sparkline: { type: "array", minItems: 2, maxItems: 20, items: { type: "number" } },
    },
  };
}

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
                "elements",
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
                // *** THE FIX *** — schema now allows (and requires!) the AI to
                // emit graphical elements. Without this entry, structured-output
                // mode strips them and you get text-only videos.
                elements: {
                  type: "array",
                  minItems: 2,
                  maxItems: 6,
                  items: elementSchemaJson(),
                },
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
                // *** THE FIX *** — same root cause as OpenAI: without this
                // entry, Gemini's structured output drops every element and
                // you get text-only videos.
                elements: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      type: {
                        type: "STRING",
                        enum: ["text", "icon", "image", "shape", "bar-chart", "line-chart", "stat", "subtitle"],
                      },
                      x: { type: "NUMBER" },
                      y: { type: "NUMBER" },
                      w: { type: "NUMBER" },
                      h: { type: "NUMBER" },
                      rotation: { type: "NUMBER" },
                      text: { type: "STRING" },
                      color: { type: "STRING" },
                      size: { type: "NUMBER" },
                      weight: { type: "INTEGER" },
                      align: { type: "STRING", enum: ["left", "center", "right"] },
                      name: { type: "STRING", enum: ICON_VOCAB },
                      src: { type: "STRING" },
                      fit: { type: "STRING", enum: ["cover", "contain"] },
                      shape: { type: "STRING", enum: ["rect", "ellipse"] },
                      fill: { type: "STRING" },
                      stroke: { type: "STRING" },
                      strokeWidth: { type: "NUMBER" },
                      radius: { type: "NUMBER" },
                      title: { type: "STRING" },
                      subtitle: { type: "STRING" },
                      rows: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: {
                            label: { type: "STRING" },
                            value: { type: "NUMBER" },
                          },
                          required: ["label", "value"],
                        },
                      },
                      points: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: {
                            label: { type: "STRING" },
                            value: { type: "NUMBER" },
                          },
                          required: ["value"],
                        },
                      },
                      line: { type: "STRING" },
                      finalValue: { type: "NUMBER" },
                      finalLabel: { type: "STRING" },
                      valuePrefix: { type: "STRING" },
                      valueSuffix: { type: "STRING" },
                      value: { type: "NUMBER" },
                      label: { type: "STRING" },
                      caption: { type: "STRING" },
                      accent: { type: "STRING" },
                      sparkline: { type: "ARRAY", items: { type: "NUMBER" } },
                    },
                    required: ["type", "x", "y", "w", "h"],
                  },
                },
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
                "elements",
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
  // Narration pace target — 150 words per minute = 2.5 words/sec. Real
  // explainer-video VOs land around 140-160 wpm, so 2.5 is a safe middle.
  // We give the model a hard target window so the script length actually
  // matches the rendered video instead of finishing 6 seconds early.
  const targetWords = Math.round(durationSec * 2.5);
  const minWords = Math.round(durationSec * 2.2);
  const maxWords = Math.round(durationSec * 2.8);

  const lines = [
    "You are a motion-graphics director AND explainer-video copywriter.",
    "Return only valid JSON that matches the requested schema.",
    `Create a ${durationSec}-second video plan from the user's prompt.`,
    "Use 3 to 5 scenes. Each scene text must be short and suitable for on-screen typography.",
    // ---- NARRATION TIMING (fixes "narration shorter/longer than video") ---
    `NARRATION SCRIPT LENGTH IS A HARD REQUIREMENT. The combined narration must take ${durationSec} seconds to read aloud at 150 words per minute. Target: ${targetWords} words total. Acceptable range: ${minWords}-${maxWords} words. Count your words before returning — if you're outside the range, rewrite. Distribute words across scenes proportional to each scene's duration (a 6-second scene gets ~${Math.round(6 * 2.5)} words; a 3-second scene gets ~${Math.round(3 * 2.5)} words).`,
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
    // Anti-overlap rule. The scene template ALWAYS draws scene.headline as the
    // big title; any text element you also add will draw on top of it and the
    // two will collide. Put the title in scene.headline (one place), and use
    // `elements` only for *additional* decorations (icons, shapes, charts,
    // subtitle bands) — never for the primary title.
    "Put the scene's primary title in scene.headline. Do NOT also add a text element whose content duplicates or paraphrases the headline — the template draws the headline itself. Reserve `elements` for icons, shapes, charts, or supplemental subtitles only.",

    // ---- COPYWRITING RULES — kill the SaaS-cliché vibe -----------------
    // The big quality complaint is generic taglines ("Unleash Your Creativity",
    // "Stunning Results, Fast", "Elevate Your Content"). They feel AI-written
    // because they ARE AI-written without constraints. These rules force the
    // model to write copy that sounds like a human ad-copywriter would write.
    "COPY QUALITY RULES (these are not optional):",
    "1) BANNED PHRASES — never use any of: 'unleash your', 'elevate your', 'take your X to the next level', 'stunning results', 'effortless', 'seamless', 'game-changer', 'revolutionize', 'transform your', 'unlock your potential', 'empower', 'cutting-edge', 'state-of-the-art', 'world-class', 'next-gen', 'simplify your workflow', 'your idea in motion', 'tap order done', 'limited time', 'get started now', 'try it free', 'visit X dot com now', 'in minutes', 'fast simple and ready to share', 'built for high-converting ads'. If you find yourself reaching for any of these, rewrite.",
    "2) BE SPECIFIC TO THE USER'S PROMPT. Reference the actual product, audience, problem, or outcome the user described. If the prompt is 'AI accounting tool for freelancers', headlines should mention freelancers, invoices, tax, time saved — not generic 'creativity' or 'workflow'. A reader should be able to guess the product from any single scene's headline.",
    "3) USE CONCRETE NOUNS AND VERBS, NOT ABSTRACTIONS. Replace 'efficiency' with 'cuts 4 hours a week'. Replace 'powerful' with 'handles 1,000 invoices an hour'. Replace 'stunning' with the specific visual thing the user sees.",
    "4) NUMBERS, WHEN HONEST, ARE GOLD. '$3.2M raised', '40% fewer clicks', '12-second checkout', '6 fonts auto-paired'. Invent reasonable numbers only when the user prompt implies them; otherwise omit.",
    "5) STRUCTURE THE NARRATIVE. Scene 1 = hook (a tension, a question, a specific 'before'). Middle scenes = 1 specific proof per scene (a feature, a number, a quote, a moment). Final scene = a verb-led, time-bound CTA tied to the product, not a generic 'Start creating today'.",
    "6) HEADLINES ≤ 7 WORDS AND ≤ 60 CHARS. Subtext ≤ 12 words. Cut every adjective that doesn't add information.",
    "7) WRITE LIKE A HUMAN COPYWRITER, NOT LIKE AN AI. Vary sentence shapes. Use fragments. Use surprise. Use rhythm. Boring is the only failure mode.",

    // ---- EXPLAINER-VIDEO NARRATION STYLE (fixes "narration is generic") ----
    "NARRATION SCRIPT STYLE — write a true explainer-video voiceover, not a list of marketing taglines:",
    "  - Address the viewer directly as 'you'. Use contractions ('you're', 'we'll', 'it's').",
    "  - Open with a relatable problem, a curiosity hook, or a specific 'before' state — not the product name.",
    "  - Each middle scene's narration EXPLAINS one feature or benefit in plain language, not lists it.",
    "  - End with a clear, low-friction next step ('Sign up free at <domain>', 'Open the app and try it today', 'Book a 10-minute demo this week').",
    "  - Sentences flow like speech: short, varied length, occasionally a fragment for emphasis.",
    "  - NO bullet-point feel. NO lists of three adjectives ('fast, simple, powerful'). NO 'introducing X'.",
    "  - The narration should make sense played alone with the screen black — it should TELL the whole story even without the visuals.",

    // ---- VISUAL DENSITY (fixes "too much text, few graphics") ----
    "VISUAL ELEMENTS — every scene MUST be visually rich, not text-only:",
    "  - The scene template already draws scene.headline and scene.subtext as the main on-screen text. You do NOT add text elements for the title.",
    "  - Every scene MUST include 2-4 graphical elements in `elements[]`: icons (lucide-react names), shapes (rect/ellipse), images (when relevant), or bar-charts (for data scenes).",
    "  - Use icons aggressively. Good lucide names to draw from: Sparkles, Zap, Clock, BarChart3, TrendingUp, ShieldCheck, Users, ArrowRight, Check, CheckCircle2, Star, Heart, Rocket, Target, Lightbulb, MessageSquare, Mail, Calendar, CreditCard, ShoppingCart, Smartphone, Monitor, Globe, Lock, Unlock, Search, Settings, Bell, Eye, EyeOff, Play, Pause, Download, Upload, Share2, Award, Trophy, ThumbsUp, Smile.",
    "  - For a scene about data or numbers, pick the RIGHT chart type:",
    "    · 'bar-chart' — comparing 2-6 categories (e.g. before/after, by team, by region). Rows are {label, value 0-100}.",
    "    · 'line-chart' — showing GROWTH over time. Points are {label?, value}; 4-10 points produce a great curve. Always include `finalValue`, `finalLabel`, and the latest value also in the last `points[].value`. Use this whenever the topic is 'growth', 'trend', 'over time', 'X to Y', 'progress'.",
    "    · 'stat' — ONE headline number you want to brag about ($1.2M, 98%, 4×, 312 users). Set `value`, `valuePrefix`/`valueSuffix` (e.g. '$', '%', 'x', 'K'), `label` (short uppercase context), and optional `caption` (sub-line). Include a 6-12 point `sparkline` array of background-trend numbers to make the stat feel alive.",
    "  - For a scene about features or steps: include 2-4 icon elements arranged horizontally or in a grid, each with a tiny text label (≤ 3 words).",
    "  - For a scene about people / testimonials: include a circular shape (profile placeholder) + a quote-style subtitle element.",
    "  - For a CTA scene: include a button-like rounded rect shape + an arrow icon.",
    "  - Text elements in `elements[]` are ONLY for tiny labels (≤ 3 words) sitting next to an icon or shape — NEVER for the scene title.",
    "  - Place elements at fractional coordinates (x, y, w, h all in 0..1). Avoid overlapping. Use the lower half / sides of the canvas so they don't collide with the template's centered headline.",
    "  - A scene with 0 elements is REJECTED. A scene with only text elements is REJECTED. Mix at least one icon or shape into every scene.",
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
    out.scenes = out.scenes.slice(0, 6).map((s, i) => {
      const scene = {
        ...s,
        scene: Number.isInteger(s?.scene) && s.scene > 0 ? s.scene : i + 1,
        duration: Math.min(15, Math.max(1, Number(s?.duration) || 4)),
        headline: s?.headline || s?.text || "",
        subtext: s?.subtext || s?.visual || "",
      };

      // Stamp ids + z + sensible defaults onto every AI-generated element.
      // The structured-output schema can't require fields the AI shouldn't
      // worry about (random ids, stacking order), so we add them here.
      if (Array.isArray(s?.elements)) {
        scene.elements = s.elements.slice(0, 8).map((el, j) => {
          const base = {
            id: `el_${i}_${j}_${Math.random().toString(36).slice(2, 8)}`,
            x: clampFrac(el?.x, 0.1),
            y: clampFrac(el?.y, 0.5),
            w: clampFrac(el?.w, 0.2),
            h: clampFrac(el?.h, 0.1),
            rotation: Number(el?.rotation) || 0,
            z: j,
            // Give every element a gentle fade-in by default so videos stop
            // feeling static. The AI can override by emitting its own
            // animation field, but with elements being new in the schema it
            // mostly won't.
            animation: { in: { kind: "fade", at: 0, duration: 0.4 } },
          };
          // Pass through type-specific fields the schema collected.
          const passthrough = [
            "type", "text", "color", "size", "weight", "align",
            "name", "src", "fit",
            "shape", "fill", "stroke", "strokeWidth", "radius",
            "title", "subtitle", "rows", "accent", "axisMax",
            "showAxis", "showValues", "valueSuffix", "bg", "fg", "bar",
            // New chart types
            "points", "line", "finalValue", "finalLabel", "valuePrefix",
            "value", "label", "caption", "sparkline", "countUp", "showGrid",
            "animationDuration",
          ];
          for (const key of passthrough) {
            if (el?.[key] !== undefined) base[key] = el[key];
          }
          // Sensible per-type defaults so Zod doesn't reject minimal elements.
          if (base.type === "bar-chart") {
            if (!Array.isArray(base.rows) || !base.rows.length) {
              base.rows = [{ label: "Item", value: 50 }];
            }
          }
          if (base.type === "shape" && !base.shape) base.shape = "rect";
          if (base.type === "icon" && !base.name) base.name = "Sparkles";
          if (base.type === "line-chart") {
            if (!Array.isArray(base.points) || base.points.length < 2) {
              base.points = [
                { label: "Q1", value: 20 },
                { label: "Q2", value: 35 },
                { label: "Q3", value: 60 },
                { label: "Q4", value: 92 },
              ];
            }
            if (typeof base.finalValue !== "number") {
              base.finalValue = base.points[base.points.length - 1].value;
            }
          }
          if (base.type === "stat") {
            if (typeof base.value !== "number") base.value = 0;
          }
          return base;
        });
      }

      return scene;
    });
  }

  return out;
}

function clampFrac(n, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
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
  const warnings = [];

  // 1. Narration length should match video runtime at ~150 wpm.
  if (script && typeof script === "string") {
    const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
    const target = Math.round(durationSec * 2.5);
    const min = Math.round(durationSec * 2.0);
    const max = Math.round(durationSec * 3.0);
    if (wordCount < min) {
      warnings.push(
        `Narration is too short: ${wordCount} words for a ${durationSec}s video (target ~${target}). Voiceover will finish early.`
      );
    } else if (wordCount > max) {
      warnings.push(
        `Narration is too long: ${wordCount} words for a ${durationSec}s video (target ~${target}). Voiceover will run past the video.`
      );
    }
  }

  // 2. Every scene should have at least one visual (icon/shape/image/chart).
  const scenes = Array.isArray(plan?.scenes) ? plan.scenes : [];
  const textOnlyScenes = scenes.filter((s) => {
    const els = Array.isArray(s.elements) ? s.elements : [];
    return !els.some((el) => ["icon", "image", "shape", "lottie", "bar-chart"].includes(el.type));
  });
  if (textOnlyScenes.length) {
    warnings.push(
      `${textOnlyScenes.length} of ${scenes.length} scene(s) have no graphical elements — they'll feel text-heavy.`
    );
  }

  // 3. Headline length sanity.
  const longHeadlines = scenes.filter(
    (s) => typeof s.headline === "string" && s.headline.length > 70
  );
  if (longHeadlines.length) {
    warnings.push(
      `${longHeadlines.length} scene headline(s) exceed 70 characters and may wrap awkwardly on screen.`
    );
  }

  // 4. Banned-phrase check (post-hoc, in case the model ignored the rule).
  const bannedPhrases = [
    "unleash your",
    "elevate your",
    "stunning results",
    "effortless",
    "seamless",
    "your idea in motion",
    "limited time",
    "tap. order. done",
    "try it free",
    "get started now",
    "simplify your workflow",
    "next level",
  ];
  const flat = JSON.stringify(plan || {}).toLowerCase() + " " + (script || "").toLowerCase();
  const hit = bannedPhrases.filter((p) => flat.includes(p));
  if (hit.length) {
    warnings.push(
      `Plan contains cliché phrase(s) the prompt told the AI to avoid: ${hit.join(", ")}.`
    );
  }

  return warnings;
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

    // Stamp the project's structureSeed (random per-video) and the user's
    // structureSeed onto the plan so the renderer's variant picker derives a
    // unique chrome/grid/align combo every time, even for repeat prompts.
    const projectDoc = await Project.findById(projectId).select("structureSeed");
    const userDoc = await User.findById(userId).select("structureSeed");
    plan.structureSeed = (projectDoc?.structureSeed ?? 0) ^ (userDoc?.structureSeed ?? 0);

    // Persist this video's structural signature on the user so the NEXT
    // generation knows what to avoid. Power-user variety engine.
    await recordVideoSignature(userId, projectId, plan).catch(() => {});

    // Quality grading — surface warnings about narration length, missing
    // graphics, headline length, and cliché phrases so the user sees the
    // root cause when a video feels off. Never fails the project.
    try {
      const qualityWarnings = gradePlanQuality(plan, script, durationSec);
      if (qualityWarnings.length) {
        await Project.updateOne(
          { _id: projectId },
          {
            $push: {
              warnings: {
                $each: qualityWarnings.map((message) => ({
                  phase: "ai",
                  message,
                  at: new Date(),
                })),
                $slice: -10,
              },
            },
          }
        );
      }
    } catch (gradeErr) {
      console.warn(`[pipeline] quality grading failed for ${projectId}:`, gradeErr);
    }

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
