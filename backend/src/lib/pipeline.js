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
import { SCENE_THEMES, VIDEO_CATEGORIES } from "./videoAssets.js";
import { getAvoidanceHints, recordVideoSignature } from "./variety.js";

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


// ---------------------------------------------------------------------------
// Random copywriting brief. Picked fresh on every generation so the AI never
// writes with the same voice / hook / temperature twice in a row. This is
// what makes the text feel different across generations — much more impactful
// than rigid count rules. See AI/copy variety discussion for the why.
// ---------------------------------------------------------------------------

// Voice presets — distinct writing styles. Each one yields a noticeably
// different feel even on the same product brief.
const COPY_VOICES = [
  "Casual, like texting a smart friend who already gets the basics. Contractions everywhere.",
  "Punchy and bold. Three-word sentences. Short verbs. Strong feel. Don't apologize.",
  "Dry humor / deadpan — the joke is in the understatement, never in the exclamation.",
  "Storyteller — open mid-scene, like a movie. The viewer drops into the middle of something.",
  "Contrarian — name a popular assumption and challenge it. 'Everyone says X. We don't think so.'",
  "Data-led — every claim grounded in a specific number, percent, or duration. No vague qualifiers.",
  "Confessional — admit a real, embarrassing problem before pitching anything.",
  "Quietly confident — no exclamation marks, no superlatives. Let the facts carry the weight.",
  "Playful and irreverent — surprising metaphors, unexpected comparisons.",
  "Direct and no-fluff — sound like a senior engineer explaining to another engineer.",
  "Cinematic — short visual descriptions, like screenplay scene headings. Big mood.",
  "Warm and human — like a friend recommending something they actually use.",
  "Provocative — open with a strong claim that makes people stop scrolling.",
  "Aspirational — paint a sharp, sensory 'after' picture early. The viewer wants in.",
  "Self-aware — acknowledge it's an ad. Earn the next 15 seconds.",
];

// Hook patterns — what scene 1 should DO. Same product becomes 10 different
// videos depending on which hook is chosen.
const HOOK_STYLES = [
  "Open with a sharp question the viewer has actually thought.",
  "Open with a surprising statistic that's specific enough to be believable.",
  "Open with a contradiction to a common belief.",
  "Open with a specific story moment ('Last Tuesday, 2am, …').",
  "Open with a single sensory detail (a sound, a sight, a feeling).",
  "Open with a confession ('I used to believe X').",
  "Open with a metaphor that reframes the problem.",
  "Open with a misdirection — start with something seemingly unrelated, then connect it.",
  "Open with a short attributed quote (feels real, attribute to a relatable persona).",
  "Open with an imperative — a verb-led command ('Stop checking email at 7am').",
  "Open with a number-then-context combo ('46 minutes. That's how long…').",
  "Open with a question-then-pause ('Ever had…? Yeah.').",
];

// Narrative frameworks — the SHAPE of the story. Rotates the structural arc.
const NARRATIVE_FRAMEWORKS = [
  "PAS — Problem, Agitate, Solve. Open with the pain.",
  "BAB — Before, After, Bridge. Show the transformation.",
  "AIDA — Attention, Interest, Desire, Action. Classic ad arc.",
  "Story — Setup, Conflict, Resolution. Treat the video like a tiny film.",
  "Compare — Old way vs new way. Side-by-side relief.",
  "Reveal — Tease, build, reveal. Make the viewer earn the answer.",
  "Demo — Show it working, prove it works, point to where to get it.",
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a random copy briefing per generation. Temperature is also randomized
 * because slight sampling variation amplifies the effect of voice/hook
 * changes — same brief at temperature 0.6 vs 0.9 gives noticeably different
 * sentence rhythms.
 */
function pickCopyBriefing() {
  return {
    voice: pickRandom(COPY_VOICES),
    hook: pickRandom(HOOK_STYLES),
    framework: pickRandom(NARRATIVE_FRAMEWORKS),
    // 0.6 - 0.95 range. Below 0.5 reads robotic; above 0.95 reads chaotic.
    temperature: Math.round((0.6 + Math.random() * 0.35) * 100) / 100,
  };
}

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
  const animationKinds = ["fade", "slide-left", "slide-right", "slide-up", "slide-down", "zoom-in", "zoom-out", "scale", "pop"];
  const animationStep = {
    type: "object",
    additionalProperties: false,
    required: ["kind", "at", "duration"],
    properties: {
      kind: { type: "string", enum: animationKinds },
      at: { type: "number", minimum: 0, maximum: 15 },
      duration: { type: "number", minimum: 0.05, maximum: 5 },
    },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["type", "x", "y", "w", "h"],
    properties: {
      type: { type: "string", enum: ["text", "icon", "image", "shape", "svg", "glow", "progress-ring", "bar-chart", "line-chart", "stat", "subtitle"] },
      x: { type: "number", minimum: 0, maximum: 1 },
      y: { type: "number", minimum: 0, maximum: 1 },
      w: { type: "number", minimum: 0.02, maximum: 1 },
      h: { type: "number", minimum: 0.02, maximum: 1 },
      rotation: { type: "number", minimum: -180, maximum: 180 },
      // Per-element entrance/exit animation — THIS is what creates the motion-graphics feel.
      animation: {
        type: "object",
        additionalProperties: false,
        properties: {
          in: animationStep,
          out: animationStep,
        },
      },
      // Text / subtitle
      text: { type: "string", maxLength: 200 },
      color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      size: { type: "number", minimum: 0.02, maximum: 0.4 },
      weight: { type: "integer", minimum: 100, maximum: 900 },
      align: { type: "string", enum: ["left", "center", "right"] },
      font: { type: "string", maxLength: 80 },
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
      showGrid: { type: "boolean" },
      animationDuration: { type: "number", minimum: 0.2, maximum: 10 },
      // Stat tile
      value: { type: "number" },
      label: { type: "string", maxLength: 80 },
      caption: { type: "string", maxLength: 160 },
      accent: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      sparkline: { type: "array", minItems: 2, maxItems: 20, items: { type: "number" } },
      countUp: { type: "boolean" },
      // SVG illustration
      paths: { type: "string", maxLength: 5000 },
      viewBox: { type: "string", maxLength: 40 },
      // Glow orb
      blur: { type: "number", minimum: 10, maximum: 200 },
      pulse: { type: "boolean" },
      // Progress ring
      trackColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      thickness: { type: "number", minimum: 2, maximum: 30 },
      // Common
      bg: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      fg: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      bar: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
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
        required: ["duration", "aspectRatio", "category", "brandColors", "scenes"],
        properties: {
          duration: { type: "number", minimum: 5, maximum: 60 },
          aspectRatio: { type: "string", enum: ["16:9", "9:16", "1:1"] },
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
                "sceneTheme",
                "animation",
                "transition",
                "elements",
              ],
              properties: {
                scene: { type: "integer", minimum: 1 },
                duration: { type: "number", minimum: 1, maximum: 15 },
                text: { type: "string", maxLength: 800 },
                headline: { type: "string", maxLength: 140 },
                subtext: { type: "string", maxLength: 240 },
                visual: { type: "string" },
                sceneTheme: { type: "string", enum: SCENE_THEMES },
                animation: { type: "string", enum: animations },
                transition: { type: "string", enum: transitions },
                elements: {
                  type: "array",
                  minItems: 1,
                  maxItems: 8,
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
                sceneTheme: { type: "STRING", enum: SCENE_THEMES },
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
                        enum: ["text", "icon", "image", "shape", "bar-chart", "line-chart", "stat", "subtitle", "svg", "glow", "progress-ring"],
                      },
                      x: { type: "NUMBER" },
                      y: { type: "NUMBER" },
                      w: { type: "NUMBER" },
                      h: { type: "NUMBER" },
                      rotation: { type: "NUMBER" },
                      // Per-element entrance/exit animation
                      animation: {
                        type: "OBJECT",
                        properties: {
                          in: {
                            type: "OBJECT",
                            properties: {
                              kind: { type: "STRING", enum: ["fade", "slide-left", "slide-right", "slide-up", "slide-down", "zoom-in", "zoom-out", "scale", "pop"] },
                              at: { type: "NUMBER" },
                              duration: { type: "NUMBER" },
                            },
                            required: ["kind", "at", "duration"],
                          },
                          out: {
                            type: "OBJECT",
                            properties: {
                              kind: { type: "STRING", enum: ["fade", "slide-left", "slide-right", "slide-up", "slide-down", "zoom-in", "zoom-out", "scale", "pop"] },
                              at: { type: "NUMBER" },
                              duration: { type: "NUMBER" },
                            },
                            required: ["kind", "at", "duration"],
                          },
                        },
                      },
                      text: { type: "STRING" },
                      color: { type: "STRING" },
                      size: { type: "NUMBER" },
                      weight: { type: "INTEGER" },
                      align: { type: "STRING", enum: ["left", "center", "right"] },
                      font: { type: "STRING" },
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
                      showGrid: { type: "BOOLEAN" },
                      animationDuration: { type: "NUMBER" },
                      value: { type: "NUMBER" },
                      label: { type: "STRING" },
                      caption: { type: "STRING" },
                      accent: { type: "STRING" },
                      sparkline: { type: "ARRAY", items: { type: "NUMBER" } },
                      countUp: { type: "BOOLEAN" },
                      bg: { type: "STRING" },
                      fg: { type: "STRING" },
                      bar: { type: "STRING" },
                      paths: { type: "STRING" },
                      viewBox: { type: "STRING" },
                      blur: { type: "NUMBER" },
                      pulse: { type: "BOOLEAN" },
                      trackColor: { type: "STRING" },
                      thickness: { type: "NUMBER" },
                    },
                    required: ["type", "x", "y", "w", "h"],
                  },
                },
              },
              required: [
                "scene",
                "duration",
                "text",
                "sceneTheme",
                "animation",
                "transition",
                "elements",
              ],
            },
          },
        },
        required: ["duration", "aspectRatio", "category", "brandColors", "scenes"],
      },
    },
    required: ["script", "plan"],
  };
}

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

function systemPrompt(durationSec, lottieAssetPrompt, avoidance, briefing) {
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
    `Available video categories: ${VIDEO_CATEGORIES.join(", ")}.`,
    `Available scene themes (animated backgrounds): ${SCENE_THEMES.join(", ")}.`,
    `Available animations: ${animations.join(", ")}.`,
    `Available transitions: ${transitions.join(", ")}.`,
    "For every scene, choose one sceneTheme from the allowed list. The theme provides an animated background; ALL visible content (headline, subtext, icons, charts) must go into the elements[] array.",
    "VARY the sceneTheme across scenes — do NOT use the same theme for every scene. Mix dark and light themes for contrast. No theme should repeat back-to-back.",
    "Favor modern ad motion: bold kinetic typography, animated dark backgrounds, glowing accent shapes, punchy reveals.",
    "No placeholder copy like [Brand Name], Company Name, your brand, or example.com.",
    "No labels inside the script. No markdown.",
    // ELEMENTS-FIRST — everything visible must be in elements[].
    "CRITICAL: ALL visible on-screen content MUST be in the elements[] array. This includes the headline, subtext, icons, shapes, and charts. The scene.headline and scene.subtext fields are OPTIONAL legacy metadata — the renderer draws ONLY what is in elements[]. If a scene has no text elements, no text will appear on screen.",
    "Every scene MUST have at least one text element for the headline (type='text', large size ~0.08-0.12, weight 800, centered near y 0.30-0.45). Optionally add a second text element for subtext (smaller size ~0.03-0.05, weight 500, below the headline near y 0.55-0.65).",

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

    // ---- ELEMENTS-FIRST VISUAL SYSTEM ----
    "ELEMENTS-FIRST SYSTEM — the sceneTheme provides an animated background. ALL visible content is in the elements[] array.",
    "",
    "EVERY ELEMENT MUST HAVE AN ANIMATION OBJECT. Without it the element just pops in with no motion — that looks broken. Use this format:",
    '  "animation": { "in": { "kind": "<kind>", "at": <seconds>, "duration": <seconds> } }',
    "  Available animation kinds: fade, slide-left, slide-right, slide-up, slide-down, zoom-in, zoom-out, scale, pop.",
    "  Stagger elements: headline at=0, subtext at=0.3, first icon at=0.5, second icon at=0.7, etc. This creates the motion-graphics feel.",
    "",
    "MANDATORY STRUCTURE per scene (minimum 5 elements, maximum 8):",
    "  1) HEADLINE text — type='text', size 0.08-0.12, weight 800, color '#ffffff'. Animation: slide-up or zoom-in at 0s.",
    "  2) SUBTEXT text — type='text', size 0.03-0.05, weight 400-500, color '#94a3b8'. Animation: fade at 0.3s.",
    "  3) At least ONE shape — accent bar, card bg, button, divider, glow circle. Shapes add visual weight.",
    "  4) At least ONE glow element — type='glow', a soft blurred orb for cinematic atmosphere. Place in background (low z). w/h 0.25-0.50.",
    "  5) At least ONE of: icon, svg illustration, progress-ring, chart (bar-chart, line-chart, stat). These are the VISUAL STAR of the scene.",
    "",
    "AVAILABLE ELEMENT TYPES (use ALL of these across your video, not just text+icon):",
    "  · text — headline, subtext, labels",
    "  · icon — lucide-react icon by name",
    "  · shape — rect or ellipse with fill/stroke/radius. Use for accent bars, buttons, cards, dividers",
    "  · svg — CUSTOM inline SVG illustration! 'paths' field contains SVG inner markup (<path>, <circle>, <rect>, <line>). Use viewBox '0 0 200 200'. Draw topic-relevant graphics: laptops, phones, charts, buildings, people outlines, logos, arrows, abstract patterns. SIZE THEM BIG (w:0.25-0.45, h:0.25-0.45).",
    "  · glow — soft blurred orb for ambient decoration. Set color to accent, blur 40-120, pulse:true for breathing effect",
    "  · progress-ring — animated donut chart. value (0-100), label, color. Great for percentages and scores",
    "  · bar-chart — animated horizontal bars with rows [{label, value}]",
    "  · line-chart — animated line graph with points [{label, value}]",
    "  · stat — big animated counter with sparkline",
    "",
    "VISUAL RICHNESS IS MANDATORY. Text-only = rejected. Every scene needs GRAPHICS:",
    "  - At least 2 scenes MUST use 'svg' elements with custom illustrations relevant to the topic",
    "  - At least 1 scene MUST use a data element (bar-chart, line-chart, stat, or progress-ring)",
    "  - Every scene MUST have at least 1 'glow' orb for cinematic atmosphere",
    "  - Every scene MUST have at least 1 'shape' for structure (accent bar, card, divider)",
    "",
    "SVG ILLUSTRATION EXAMPLES (use as starting points, adapt to the topic):",
    "  Laptop: {\"type\":\"svg\",\"x\":0.30,\"y\":0.15,\"w\":0.40,\"h\":0.35,\"paths\":\"<rect x='30' y='20' width='140' height='100' rx='8' fill='none' stroke='#8b5cf6' stroke-width='3'/><rect x='50' y='40' width='100' height='60' rx='4' fill='#1e293b'/><path d='M20 130 L180 130' stroke='#8b5cf6' stroke-width='3'/>\",\"viewBox\":\"0 0 200 160\"}",
    "  Phone: {\"type\":\"svg\",\"x\":0.40,\"y\":0.20,\"w\":0.20,\"h\":0.45,\"paths\":\"<rect x='40' y='10' width='120' height='180' rx='16' fill='none' stroke='#38bdf8' stroke-width='3'/><rect x='50' y='30' width='100' height='140' rx='4' fill='#0f172a'/><circle cx='100' cy='185' r='5' fill='#38bdf8'/>\",\"viewBox\":\"0 0 200 200\"}",
    "  Play button: {\"type\":\"svg\",\"x\":0.42,\"y\":0.35,\"w\":0.16,\"h\":0.16,\"paths\":\"<circle cx='100' cy='100' r='80' fill='none' stroke='#ef4444' stroke-width='4'/><polygon points='80,60 80,140 140,100' fill='#ef4444'/>\",\"viewBox\":\"0 0 200 200\"}",
    "  Chart: {\"type\":\"svg\",\"x\":0.55,\"y\":0.20,\"w\":0.35,\"h\":0.35,\"paths\":\"<line x1='20' y1='180' x2='20' y2='20' stroke='#475569' stroke-width='2'/><line x1='20' y1='180' x2='180' y2='180' stroke='#475569' stroke-width='2'/><polyline points='30,150 70,100 110,120 150,50 170,70' fill='none' stroke='#34d399' stroke-width='3'/><circle cx='150' cy='50' r='5' fill='#34d399'/>\",\"viewBox\":\"0 0 200 200\"}",
    "",
    "EXAMPLE HOOK SCENE (rich visuals — notice glow, svg, shape, not just text):",
    '  {"scene":1,"duration":5,"text":"Narration here...","sceneTheme":"gradient-flow","animation":"fade-in","transition":"fade",',
    '   "elements":[',
    '     {"type":"glow","x":0.10,"y":0.05,"w":0.35,"h":0.35,"z":0,"color":"#8b5cf6","blur":80,"pulse":true,"animation":{"in":{"kind":"fade","at":0,"duration":0.8}}},',
    '     {"type":"glow","x":0.60,"y":0.55,"w":0.30,"h":0.30,"z":0,"color":"#38bdf8","blur":60,"pulse":true,"animation":{"in":{"kind":"fade","at":0.2,"duration":0.8}}},',
    '     {"type":"svg","x":0.35,"y":0.08,"w":0.30,"h":0.30,"z":1,"paths":"<circle cx=\\"100\\" cy=\\"100\\" r=\\"80\\" fill=\\"none\\" stroke=\\"#8b5cf6\\" stroke-width=\\"3\\"/><polygon points=\\"80,60 80,140 140,100\\" fill=\\"#8b5cf6\\"/>","viewBox":"0 0 200 200","animation":{"in":{"kind":"zoom-in","at":0.1,"duration":0.5}}},',
    '     {"type":"text","x":0.08,"y":0.42,"w":0.84,"h":0.16,"z":2,"text":"Your Big Headline","size":0.10,"weight":800,"color":"#ffffff","align":"center","animation":{"in":{"kind":"slide-up","at":0.2,"duration":0.5}}},',
    '     {"type":"shape","x":0.35,"y":0.60,"w":0.30,"h":0.005,"z":2,"shape":"rect","fill":"#8b5cf6","radius":99,"animation":{"in":{"kind":"scale","at":0.4,"duration":0.4}}},',
    '     {"type":"text","x":0.15,"y":0.64,"w":0.70,"h":0.08,"z":2,"text":"Supporting subtext here","size":0.04,"weight":500,"color":"#94a3b8","align":"center","animation":{"in":{"kind":"fade","at":0.5,"duration":0.4}}},',
    '     {"type":"icon","x":0.44,"y":0.78,"w":0.08,"h":0.08,"z":3,"name":"Sparkles","color":"#8b5cf6","animation":{"in":{"kind":"pop","at":0.7,"duration":0.3}}}',
    "  ]}",
    "",
    "EXAMPLE DATA SCENE (charts + progress ring + svg):",
    '  {"scene":2,"duration":6,"text":"Revenue grew 340% in one quarter.","sceneTheme":"spotlight","animation":"slide-left","transition":"cut",',
    '   "elements":[',
    '     {"type":"glow","x":0.50,"y":0.30,"w":0.40,"h":0.40,"z":0,"color":"#34d399","blur":100,"animation":{"in":{"kind":"fade","at":0,"duration":0.6}}},',
    '     {"type":"text","x":0.05,"y":0.06,"w":0.50,"h":0.12,"z":2,"text":"Revenue Growth","size":0.08,"weight":800,"color":"#ffffff","align":"left","animation":{"in":{"kind":"slide-left","at":0,"duration":0.5}}},',
    '     {"type":"shape","x":0.05,"y":0.19,"w":0.15,"h":0.004,"z":2,"shape":"rect","fill":"#34d399","radius":99,"animation":{"in":{"kind":"scale","at":0.2,"duration":0.3}}},',
    '     {"type":"line-chart","x":0.52,"y":0.10,"w":0.44,"h":0.50,"z":2,"points":[{"label":"Q1","value":20},{"label":"Q2","value":45},{"label":"Q3","value":78},{"label":"Q4","value":120}],"finalValue":120,"valueSuffix":"K","valuePrefix":"$","line":"#34d399","showGrid":true,"animationDuration":1.8,"animation":{"in":{"kind":"fade","at":0.2,"duration":0.4}}},',
    '     {"type":"progress-ring","x":0.05,"y":0.35,"w":0.20,"h":0.20,"z":2,"value":92,"label":"SCORE","color":"#fbbf24","animationDuration":1.5,"animation":{"in":{"kind":"zoom-in","at":0.4,"duration":0.5}}},',
    '     {"type":"stat","x":0.05,"y":0.62,"w":0.40,"h":0.30,"z":2,"value":340,"valueSuffix":"%","label":"GROWTH","caption":"year over year","accent":"#fbbf24","sparkline":[10,18,25,40,55,70,88,120],"animation":{"in":{"kind":"zoom-in","at":0.6,"duration":0.5}}}',
    "  ]}",
    "",
    "EXAMPLE CTA SCENE (shapes + glow + icons):",
    '  {"scene":4,"duration":4,"text":"Try it free today.","sceneTheme":"bold-color","animation":"zoom-in","transition":"fade",',
    '   "elements":[',
    '     {"type":"glow","x":0.25,"y":0.20,"w":0.50,"h":0.50,"z":0,"color":"#8b5cf6","blur":120,"pulse":true,"animation":{"in":{"kind":"fade","at":0,"duration":0.5}}},',
    '     {"type":"text","x":0.10,"y":0.25,"w":0.80,"h":0.16,"z":2,"text":"Start Free Today","size":0.11,"weight":800,"color":"#ffffff","align":"center","animation":{"in":{"kind":"zoom-in","at":0,"duration":0.4}}},',
    '     {"type":"shape","x":0.25,"y":0.50,"w":0.50,"h":0.10,"z":2,"shape":"rect","fill":"#ffffff","radius":99,"animation":{"in":{"kind":"slide-up","at":0.3,"duration":0.4}}},',
    '     {"type":"text","x":0.27,"y":0.51,"w":0.46,"h":0.08,"z":3,"text":"Get Started →","size":0.04,"weight":700,"color":"#0f172a","align":"center","animation":{"in":{"kind":"fade","at":0.4,"duration":0.3}}},',
    '     {"type":"shape","x":0.10,"y":0.72,"w":0.80,"h":0.003,"z":1,"shape":"rect","fill":"#8b5cf644","radius":99,"animation":{"in":{"kind":"scale","at":0.5,"duration":0.4}}},',
    '     {"type":"icon","x":0.82,"y":0.74,"w":0.10,"h":0.10,"z":3,"name":"ArrowRight","color":"#ffffff","animation":{"in":{"kind":"slide-right","at":0.5,"duration":0.3}}}',
    "  ]}",
    "",
    "SCENE TYPE PATTERNS — pick the right one for each scene's job:",
    "  · HOOK: 2 glow orbs (bg) + svg illustration (topic-relevant, big) + headline + accent bar shape + subtext + icon. 6-7 elements.",
    "  · FEATURE: glow orb + headline + accent divider shape + svg illustration or device mockup + 2 icons + subtext. 6-7 elements.",
    "  · DATA: glow orb + headline + accent bar + chart (line/bar) + progress-ring or stat + shape card bg. 5-6 elements.",
    "  · SOCIAL PROOF: glow orb + headline + ellipse shape (avatar) + quote text + accent bar + icon. 5-6 elements.",
    "  · CTA: glow orb (centered, big) + headline (zoom-in) + pill button shape + button label text + accent line + arrow icon. 6-7 elements.",
    "",
    "LAYOUT RULES:",
    "  - Headline: centered y 0.28-0.42 for centered layouts, or x 0.05 y 0.08 for left-aligned with chart.",
    "  - Icons: w 0.06-0.12. Place in rows (y 0.72-0.88, spaced x apart) or gutters.",
    "  - Charts: w 0.35-0.50, h 0.35-0.50. Right half or bottom half of frame.",
    "  - Shapes: decorative accents w 0.06-0.20, or button shapes w 0.20-0.40.",
    "  - NO ELEMENT below w=0.04 or h=0.04.",
    "  - NO OVERLAP between elements.",
    "",
    "ICON NAMES (lucide-react): Sparkles, Zap, Rocket, Clock, Star, Heart, ThumbsUp, Target, Lightbulb, TrendingUp, BarChart3, ShieldCheck, Users, ArrowRight, Check, CheckCircle2, MessageSquare, Mail, Calendar, CreditCard, ShoppingCart, Smartphone, Monitor, Globe, Lock, Search, Settings, Bell, Play, Download, Upload, Share2, Award, Trophy, Smile, Coffee, Code, Terminal, Cpu, Bot, Brain.",
    // ---- Field-format rules (these prevent Zod validation failures) ----
    "FIELD-FORMAT RULES — ignoring these will cause the project to FAIL VALIDATION:",
    "  - Color fields (color, fill, stroke, accent, bg, fg, bar, line) MUST be #RRGGBB hex strings only. Never 'white', 'transparent', 'none', 'rgb(...)', or any non-hex value. If you don't need a color, OMIT the field — never set it to a non-hex string.",
    "  - Font 'weight' (when set) MUST be a multiple of 100 between 100 and 900 (i.e. 100, 200, 300, 400, 500, 600, 700, 800, 900). Never 0, 50, 'bold', or 'normal'.",
    "  - Numeric coordinates (x, y, w, h) MUST be fractional 0..1.",
  ];

  // ---- Random copy briefing — sprinkled near the top so it sets the tone
  // before the rules. We push it onto the prompt array AFTER the boilerplate
  // headers but BEFORE the copy-quality rules so it actually frames how the
  // copy gets written.
  if (briefing) {
    lines.push(
      "WRITING BRIEF FOR THIS GENERATION (chosen at random — do not break character):",
      `  VOICE: ${briefing.voice}`,
      `  HOOK STYLE for scene 1: ${briefing.hook}`,
      `  NARRATIVE FRAMEWORK: ${briefing.framework}`,
      "Stay consistent with this brief across all scenes. The brief is binding."
    );
  }

  // Anti-repetition: tell the model what this user has already seen recently
  // so we don't keep producing the same structural fingerprint for power users.
  if (avoidance && (avoidance.themes?.length || avoidance.sequences?.length)) {
    const parts = [];
    if (avoidance.themes?.length) {
      parts.push(
        `This user has used these themes a lot recently — AVOID them: ${avoidance.themes.join(", ")}.`
      );
    }
    if (avoidance.sequences?.length) {
      parts.push(
        `Do NOT reuse these recent scene-theme sequences: ${avoidance.sequences.map((s) => `"${s}"`).join("; ")}.`
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
  avoidance,
  briefing,
  referenceImage
) {
  // Build user message — text only, or multimodal with reference image.
  const userContent = referenceImage
    ? [
        {
          type: "text",
          text: `${prompt}\n\nREFERENCE IMAGE ATTACHED — use it ONLY as a design layout blueprint. Extract:\n- Layout structure: where elements are positioned (left/right/center, top/bottom, split layouts)\n- Color palette: dominant colors, accent colors, background tones\n- Typography hierarchy: large vs small text sizing, weight contrast, alignment\n- Element arrangement: spacing, grouping, visual flow\n- Visual density: how many elements per section, whitespace balance\n\nDO NOT copy any text content, brand names, logos, or specific imagery from the reference. The TEXT and CONTENT must come entirely from the user's prompt above. Only the DESIGN STRUCTURE and VISUAL STYLE should be replicated.`,
        },
        {
          type: "image_url",
          image_url: { url: referenceImage, detail: "high" },
        },
      ]
    : prompt;

  const isOpenRouter = config.provider === "openrouter";
  const chatUrl = isOpenRouter ? OPENROUTER_CHAT_URL : OPENAI_CHAT_COMPLETIONS_URL;

  // OpenRouter free models don't support strict json_schema — fall back to
  // json_object and rely on the system prompt to enforce structure.
  const responseFormat = isOpenRouter
    ? { type: "json_object" }
    : {
        type: "json_schema",
        json_schema: {
          name: "motion_video_generation",
          strict: true,
          schema: createGeneratedPayloadSchema(lottieAssetIds),
        },
      };

  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  if (isOpenRouter) {
    headers["HTTP-Referer"] = process.env.WEB_ORIGIN || "http://localhost:5173";
    headers["X-Title"] = "AI Video Generator";
  }

  const res = await fetch(chatUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: systemPrompt(durationSec, lottieAssetPrompt, avoidance, briefing),
        },
        { role: "user", content: userContent },
      ],
      response_format: responseFormat,
      temperature: briefing?.temperature ?? 0.7,
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
  avoidance,
  briefing,
  referenceImage
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

  // Build parts — text + optional reference image.
  const parts = [];
  let textPrompt = `${systemPrompt(durationSec, lottieAssetPrompt, avoidance, briefing)}\n\nReturn this JSON shape: {"script":"...","plan":{...}}.\n\nPrompt: ${prompt}`;
  if (referenceImage) {
    textPrompt += "\n\nREFERENCE IMAGE ATTACHED — use it ONLY as a design layout blueprint. Extract layout structure, color palette, typography hierarchy, element arrangement, and visual density. DO NOT copy any text content, brand names, or specific imagery from it. Content comes from the user's prompt only.";
    // Extract base64 data and mime type from data URL.
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
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: createGeminiResponseSchema(lottieAssetIds),
        temperature: briefing?.temperature ?? 0.7,
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

const ENHANCE_SYSTEM_PROMPT = `You are a senior motion graphics creative director. Transform the user's rough idea into a detailed, production-ready motion graphics video brief. Return plain text only, under 180 words.

YOUR OUTPUT MUST INCLUDE ALL OF THESE:

1. VIDEO CONCEPT — One punchy sentence describing the video's purpose and audience.

2. VISUAL STYLE — Specify:
   - Color palette: 3-4 specific hex colors (e.g. "Deep navy #0f172a, electric violet #8b5cf6, cyan accent #38bdf8")
   - Typography: font weight (800 for headlines, 500 for body), size hierarchy (large headline, medium subtext)
   - Background mood: which theme fits (gradient-flow, spotlight, aurora, mesh-gradient, geometric, bold-color, minimal-dark)

3. SCENE BREAKDOWN — 3-5 scenes, each with:
   - Headline text (≤7 words, punchy)
   - Supporting visual elements: icons (name specific lucide icons like Rocket, TrendingUp, ShieldCheck), shapes (rounded rect buttons, accent bars), or data (stat counters, line charts, bar charts)
   - Animation style per scene: slide-up headlines, pop-in icons, zoom-in stats, fade subtexts

4. MOTION FEEL — Describe the pacing: "Fast cuts with staggered element entrances" or "Slow cinematic reveals with 0.5s staggers"

5. NARRATION TONE — Speaking style for the voiceover: conversational, authoritative, playful, data-driven, etc.

Be specific. Never generic. Reference the actual product/topic from the user's input.`;

// ---------------------------------------------------------------------------
// CODE-GEN: AI writes a complete Remotion React component per video.
// The generated file is saved to remotion/generated/Current.jsx and the
// worker re-bundles before rendering, so the code IS the video.
// ---------------------------------------------------------------------------

const CODEGEN_SYSTEM_PROMPT = `You are a world-class motion graphics artist who writes Remotion React code. You create CINEMATIC, visually stunning animated videos — not slideshows with text. Every frame must look like it belongs in a professional broadcast or a premium product launch.

RULES:
1. Use ONLY these imports from "remotion": AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Series.
2. Export a SINGLE default functional component. No props — read duration from useVideoConfig().
3. ALL styles inline. No CSS files, no styled-components, no Tailwind.
4. ALL sub-components in the SAME file. No external imports except "remotion".
5. Output ONLY the JSX code. No markdown fences, no explanations.
6. Font: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif".

═══════════════════════════════════════════════════════════════
ANIMATION TOOLKIT
═══════════════════════════════════════════════════════════════

spring({ frame, fps, config: { damping: 12-20, stiffness: 120-200, mass: 0.5-1.2 } })
interpolate(frame, [start, end], [from, to], { extrapolateRight: "clamp" })
Sequence with from={frameNumber} for timing
Series + Series.Sequence for back-to-back scenes

ADVANCED PATTERNS you MUST use:
- Easing curves: const ease = (t) => t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2
- Continuous motion: Math.sin(frame * 0.05) for floating/breathing
- Parallax layers: multiple backgrounds moving at different speeds
- Camera push: scale 1 → 1.08 over the scene duration for cinematic drift
- Blur reveals: filter blur going from 20px → 0px as element enters

═══════════════════════════════════════════════════════════════
CINEMATIC VISUAL SYSTEM — THIS IS THE MOST IMPORTANT SECTION
═══════════════════════════════════════════════════════════════

Your videos must be VISUALLY RICH. Text alone is a slideshow. You are making MOTION GRAPHICS.

EVERY SCENE MUST HAVE ALL OF THESE LAYERS (back to front):

LAYER 1 — ANIMATED BACKGROUND (mandatory):
  Create a function like AnimatedBackground that renders MULTIPLE moving elements:
  - Gradient mesh: 2-3 radial gradients that MOVE (shift position with interpolate)
  - Floating orbs: 4-8 blurred circles (blur 40-80px) drifting slowly across frame
  - Grid/dot pattern: subtle CSS background-image with backgroundPosition animating
  - Noise texture: repeating-conic-gradient or radial-gradient patterns at low opacity
  Example: Large soft circle at 20% opacity, position shifts with Math.sin(frame*0.03)*50

LAYER 2 — GEOMETRIC DECORATION (mandatory):
  Create a function like GeometricElements that renders 3-6 decorative shapes:
  - Rotating rings: SVG circles with strokeDasharray, rotating via transform
  - Animated lines: thin lines that grow from 0% to 100% width
  - Corner brackets: L-shaped lines in 2 corners (top-left, bottom-right)
  - Floating diamonds/hexagons: small shapes with rotate + translateY animation
  - Parallax dots: grid of small dots moving at 0.5x scroll speed
  - Glowing accent lines: thin horizontal/vertical bars with boxShadow glow
  Example SVG ring: <svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" fill="none" stroke={accent} strokeWidth="2" strokeDasharray="502" strokeDashoffset={502 * (1 - progress)} transform={\`rotate(\${frame * 0.5} 100 100)\`}/></svg>

LAYER 3 — INLINE SVG ILLUSTRATIONS (mandatory for at least 2 scenes):
  Draw CUSTOM SVG graphics relevant to the topic. NOT just circles and rects.
  Examples by topic:
  - Tech/SaaS: laptop outline, browser window, code brackets, server rack, cloud shape
  - Business: rising bar chart, pie chart, briefcase, handshake, target/bullseye
  - Social media: phone mockup, play button, heart/like, notification bell, chat bubble
  - Education: book, graduation cap, lightbulb, brain outline
  - Health: heartbeat line (animated SVG path), shield with cross
  - Food: plate/utensils, chef hat, delivery bag
  - Finance: dollar sign, credit card, trending arrow, wallet
  - YouTube: play button triangle, subscriber bell, video camera
  Build these from basic SVG: <path>, <rect>, <circle>, <polygon>, <line>.
  Animate them: strokeDashoffset for draw-on effect, scale for pop-in, opacity for fade.
  SIZE THEM BIG: 150-300px. They should be a major visual, not a tiny icon.

LAYER 4 — DATA VISUALIZATION (at least 1 scene):
  Animated charts built from divs or SVG:
  - Bar chart: divs with height animating from 0 to target via spring
  - Line chart: SVG polyline with strokeDashoffset animation (draw-on)
  - Donut/ring chart: SVG circle with strokeDasharray showing percentage
  - Counter: number counting from 0 to target with Math.round(interpolate(...))
  - Progress bar: div width growing from 0% to target%
  - Stat grid: 2x2 grid of big numbers with labels, each counting up staggered

LAYER 5 — TYPOGRAPHY (this is the ONLY text layer):
  Headlines: 52-80px, weight 800-900, white. Max 6 words.
  Subtexts: 22-30px, weight 400, #94a3b8. Max 12 words.
  Entrance: spring translateY + opacity, or clip-path reveal, or blur reveal.
  Text effects to use:
  - Gradient text: background clip + linear-gradient on the text
  - Glow: textShadow with accent color "0 0 40px #8b5cf688"
  - Letter spacing animation: letterSpacing interpolating from 0.2em to -0.02em
  - Word-by-word reveal: split text into words, stagger each word's entrance

LAYER 6 — PARTICLE SYSTEM (mandatory):
  Create a Particles component. Generate 15-30 small elements:
  const particles = Array.from({length: 20}, (_, i) => ({
    x: (i * 37 + 13) % 100,
    y: (i * 53 + 7) % 100,
    size: 2 + (i % 4) * 2,
    speed: 0.3 + (i % 5) * 0.2,
    delay: i * 3,
  }));
  Render each as a small circle/diamond, floating upward, fading in/out.
  Opacity: 0.1-0.3. Adds cinematic atmosphere without being distracting.

═══════════════════════════════════════════════════════════════
COLOR PALETTES (pick one per video, stay consistent)
═══════════════════════════════════════════════════════════════

DARK PREMIUM: bg #0a0a1a, surface #141428, accent #8b5cf6, secondary #38bdf8, text #f1f5f9
MIDNIGHT BLUE: bg #0c1222, surface #162032, accent #3b82f6, secondary #06b6d4, text #e2e8f0
DARK EMERALD: bg #021a0f, surface #052e16, accent #10b981, secondary #34d399, text #ecfdf5
WARM DARK: bg #1c1210, surface #292018, accent #f59e0b, secondary #ef4444, text #fef3c7
NEON: bg #09090b, surface #18181b, accent #a855f7, secondary #ec4899, text #fafafa

═══════════════════════════════════════════════════════════════
SCENE TEMPLATES (adapt these, don't copy verbatim)
═══════════════════════════════════════════════════════════════

HOOK SCENE (scene 1, 4-6 sec):
  - Background: animated gradient mesh shifting left to right
  - Particles floating up
  - Large SVG illustration related to topic (centered, 250px, fades + scales in)
  - Headline with spring bounce entrance from below
  - Subtitle fading in 0.4s later
  - Accent line growing from center outward under the headline
  - Corner brackets animating in at top-left and bottom-right

FEATURE SCENE (middle, 4-6 sec):
  - Background: subtle grid pattern + floating orbs
  - Left half: headline + 2-3 bullet points appearing with stagger
  - Right half: large SVG illustration or device mockup
  - Decorative ring rotating slowly behind the illustration
  - Small icon badges popping in near the feature bullets
  - Accent bar on the left edge sliding down

DATA SCENE (middle, 5-7 sec):
  - Background: dot grid with parallax
  - Large animated chart (bar chart or line chart) taking 40-50% of the frame
  - 2-3 stat counters around the chart, counting up
  - Headline at top describing the data
  - Glowing accent line under the chart
  - Numbers should count up with spring easing

SHOWCASE SCENE (middle, 4-6 sec):
  - Background: radial gradient spotlight
  - Center: device mockup or browser window (drawn with SVG/CSS)
  - Inside mockup: simplified UI representation (colored rectangles for content)
  - Floating badge with "NEW" or a checkmark popping in
  - Subtle scale animation on the mockup (1 → 1.02 breathing)

CTA SCENE (final, 3-5 sec):
  - Background: intensified gradient, all orbs converging to center
  - Big headline zooming in with spring
  - Animated button shape (rounded rect) sliding up from below
  - Button text fading in after button appears
  - Arrow icon animating to the right repeatedly
  - Particle burst effect (particles exploding outward from center)
  - Pulsing glow ring around the button

═══════════════════════════════════════════════════════════════
CINEMATIC EFFECTS — use at least 3 per video
═══════════════════════════════════════════════════════════════

1. CAMERA DRIFT: entire scene slowly scales from 1.0 to 1.06 over its duration
2. LIGHT SWEEP: a diagonal white gradient bar (10% opacity) moves across the frame
3. VIGNETTE: radial-gradient(ellipse, transparent 50%, rgba(0,0,0,0.4) 100%)
4. FILM GRAIN: tiny noise overlay via repeating-conic-gradient at 2% opacity
5. LENS FLARE: bright circle (blur 60px) that moves along a diagonal path
6. REVEAL WIPE: clip-path: inset(0 100% 0 0) → inset(0 0% 0 0) for side reveals
7. SCALE PULSE: element breathing between scale 1.0 and 1.03 with Math.sin
8. GLOW PULSE: boxShadow opacity pulsing with Math.sin for attention
9. PATH DRAW: SVG with strokeDasharray + animated strokeDashoffset
10. MORPH TRANSITION: borderRadius animating from 0% to 50% (square → circle)

═══════════════════════════════════════════════════════════════
TIMING (30 fps)
═══════════════════════════════════════════════════════════════

- 3-5 scenes per video
- Use Series + Series.Sequence for sequential scenes
- Element stagger: 4-8 frames apart
- Entrances: 8-15 frames each (spring for bounce, interpolate for smooth)
- Camera drift: runs the ENTIRE scene duration
- Particles: run continuously
- Hold after all entrances: at least 30 frames
- Total matches useVideoConfig().durationInFrames exactly

═══════════════════════════════════════════════════════════════
ABSOLUTE REQUIREMENTS — FAILURE TO FOLLOW = REJECTED
═══════════════════════════════════════════════════════════════

1. NO scene may be text-only. Every scene MUST have shapes, SVG graphics, or charts.
2. EVERY scene MUST have animated background + particles + geometric decoration.
3. At least 2 scenes MUST have custom inline SVG illustrations relevant to the topic.
4. At least 1 scene MUST have animated data (chart, counter, or progress bar).
5. Minimum 8 animated elements per scene (shapes + text + SVG + particles count).
6. Use spring() for at least 3 entrance animations. Use interpolate() for continuous motion.
7. Text is NEVER more than 30% of the visual. Graphics dominate.

OUTPUT: Raw JSX code starting with import. No markdown, no fences, no explanation.`;

const CODEGEN_GENERATED_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "remotion",
  "generated"
);

/**
 * Ask AI to write a complete Remotion component for the given prompt.
 * Returns the JSX code as a string.
 */
async function generateVideoCode(prompt, durationSec, config, userId, referenceImage) {
  const totalFrames = durationSec * 30;
  const userText = "Create a " + durationSec + "-second (" + totalFrames + " frames at 30fps) motion-graphics video:\n" + prompt + "\n\nRemember: output ONLY the JSX code, starting with the import statement. No markdown fences.";

  if (config.provider === "openai" || config.provider === "openrouter") {
    const isOR = config.provider === "openrouter";
    const userContent = referenceImage
      ? [
          { type: "text", text: userText + "\n\nREFERENCE IMAGE: Use ONLY as layout/style blueprint. Extract layout, colors, typography hierarchy. DO NOT copy text content or logos." },
          { type: "image_url", image_url: { url: referenceImage, detail: "high" } },
        ]
      : userText;

    const headers = {
      Authorization: "Bearer " + config.apiKey,
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
          { role: "system", content: CODEGEN_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      const errBody = await readErrorBody(res);
      throw new Error((isOR ? "OpenRouter" : "OpenAI") + " code generation failed (" + res.status + "): " + errBody);
    }

    const data = await res.json();
    await recordApiUsage({
      userId,
      config,
      purpose: "video_codegen",
      usage: usageFromOpenAI(data.usage),
    });
    return extractCode(data.choices?.[0]?.message?.content);
  }

  // Gemini
  const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + config.model + ":generateContent?key=" + config.apiKey;
  const parts = [];
  let textContent = CODEGEN_SYSTEM_PROMPT + "\n\n" + userText;
  if (referenceImage) {
    textContent += "\n\nREFERENCE IMAGE: Use ONLY as layout/style blueprint. Extract layout, colors, typography hierarchy. DO NOT copy text content or logos.";
    const match = referenceImage.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
  }
  parts.unshift({ text: textContent });

  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8000 },
    }),
  });

  if (!res.ok) {
    const errBody = await readErrorBody(res);
    throw new Error("Gemini code generation failed (" + res.status + "): " + errBody);
  }

  const data = await res.json();
  await recordApiUsage({
    userId,
    config,
    purpose: "video_codegen",
    usage: usageFromGemini(data.usageMetadata),
  });
  return extractCode(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

function extractCode(raw) {
  if (!raw || typeof raw !== "string") throw new Error("AI returned empty code");
  // Strip markdown fences if present
  let code = raw.trim();
  const fenceMatch = code.match(/^```(?:jsx|javascript|js|tsx)?\n([\s\S]*?)```$/);
  if (fenceMatch) code = fenceMatch[1].trim();
  // Must contain remotion import to be valid
  if (!code.includes("remotion")) {
    throw new Error("Generated code does not import from remotion — invalid output");
  }
  return code;
}

/**
 * Write the generated JSX code to remotion/generated/Current.jsx so the
 * Remotion bundler picks it up on the next bundle() call.
 */
export function writeGeneratedCode(code) {
  fs.mkdirSync(CODEGEN_GENERATED_DIR, { recursive: true });
  const filePath = path.join(CODEGEN_GENERATED_DIR, "Current.jsx");
  fs.writeFileSync(filePath, code, "utf-8");
  return filePath;
}

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
        sceneTheme: s?.sceneTheme || s?.sceneTemplate || "gradient-flow",
      };

      // Stamp ids + z + sensible defaults onto every AI-generated element.
      // The structured-output schema can't require fields the AI shouldn't
      // worry about (random ids, stacking order), so we add them here.
      if (Array.isArray(s?.elements)) {
        scene.elements = s.elements.slice(0, 8).map((el, j) => {
          // Enforce minimum element size — 4% of frame width/height. Anything
          // smaller is invisible at typical viewing sizes (the AI sometimes
          // emits 0.01 thinking it's pixels).
          const minDim = 0.04;
          // Staggered entrance animations — each element enters slightly
          // later than the previous one, creating the motion-graphics feel.
          const staggerKinds = ["slide-up", "fade", "pop", "zoom-in", "slide-left"];
          const defaultAnim = {
            in: {
              kind: staggerKinds[j % staggerKinds.length],
              at: Math.round(j * 0.2 * 100) / 100,
              duration: 0.4,
            },
          };
          const base = {
            id: `el_${i}_${j}_${Math.random().toString(36).slice(2, 8)}`,
            x: clampFrac(el?.x, 0.1),
            y: clampFrac(el?.y, 0.5),
            w: Math.max(minDim, clampFrac(el?.w, 0.2)),
            h: Math.max(minDim, clampFrac(el?.h, 0.1)),
            rotation: Number(el?.rotation) || 0,
            z: j,
            // Use AI-provided animation if present, otherwise staggered default.
            animation: el?.animation?.in ? el.animation : defaultAnim,
          };
          // Pass through type-specific fields the schema collected, with
          // per-field sanitization to absorb the AI's small mistakes (font
          // weight outside 100-900, "transparent" instead of #hex, etc.) so
          // they don't blow up Zod validation and fail the whole project.
          const passthrough = [
            "type", "text", "color", "size", "weight", "align", "font",
            "name", "src", "fit",
            "shape", "fill", "stroke", "strokeWidth", "radius",
            "title", "subtitle", "rows", "accent", "axisMax",
            "showAxis", "showValues", "valueSuffix", "bg", "fg", "bar",
            "points", "line", "finalValue", "finalLabel", "valuePrefix",
            "value", "label", "caption", "sparkline", "countUp", "showGrid",
            "animationDuration",
            // SVG illustration
            "paths", "viewBox",
            // Glow orb
            "blur", "pulse",
            // Progress ring
            "trackColor", "thickness",
          ];
          // Hex-only color fields. If the AI emits "transparent", "none",
          // "black", "rgb(…)", or any non-hex value, drop the field entirely
          // — they're all optional, the renderer falls back to brand colors.
          const hexFields = new Set([
            "color", "fill", "stroke", "accent", "bg", "fg", "bar", "line", "trackColor",
          ]);
          // Strict-range numeric fields. Each is { min, max, default? }.
          // `default` is used when the AI emits something completely
          // unparseable (NaN, string, etc.) — otherwise we clamp to min/max.
          const numericRanges = {
            weight: { min: 100, max: 900, step: 100 },     // font weight
            size: { min: 0.005, max: 1 },                  // font size frac
            strokeWidth: { min: 0, max: 100 },
            radius: { min: 0, max: 500 },
            axisMax: { min: 1, max: 10000 },
            animationDuration: { min: 0.05, max: 60 },
          };
          for (const key of passthrough) {
            const v = el?.[key];
            if (v === undefined || v === null) continue;
            if (hexFields.has(key)) {
              // Only accept #rgb / #rrggbb / #rrggbbaa.
              if (typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v.trim())) {
                base[key] = v.trim();
              }
              // Otherwise: drop. Field is optional everywhere.
            } else if (key in numericRanges) {
              const n = Number(v);
              const { min, max, step } = numericRanges[key];
              if (Number.isFinite(n)) {
                let clamped = Math.max(min, Math.min(max, n));
                if (step) clamped = Math.round(clamped / step) * step;
                base[key] = clamped;
              }
              // Unparseable → omit, Zod's optional() takes over.
            } else {
              base[key] = v;
            }
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
          // Clamp so the element box doesn't extend past the right/bottom
          // edge of the canvas — the AI sometimes picks x=0.9 + w=0.4 which
          // pushes 30% of the element off-screen.
          if (base.x + base.w > 1) base.w = Math.max(minDim, 1 - base.x);
          if (base.y + base.h > 1) base.h = Math.max(minDim, 1 - base.y);
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
  // Strip ALL punctuation + collapse whitespace before matching, so "Tap.
  // Order. Done." and "tap order done" both hit. This is the matching bug
  // that let "Tap. Order. Done." slip into a render.
  const bannedPhrases = [
    "unleash your",
    "elevate your",
    "stunning results",
    "effortless",
    "seamless",
    "your idea in motion",
    "limited time",
    "tap order done",
    "try it free",
    "get started now",
    "simplify your workflow",
    "next level",
    "make every second count",
    "level up",
    "supercharge",
    "powerful insights",
    "actionable insights",
    "in just minutes",
    "join thousands",
    "trusted by",
    "cut through the noise",
  ];
  const normalize = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const flat = normalize(JSON.stringify(plan || {}) + " " + (script || ""));
  const hit = bannedPhrases.filter((p) => flat.includes(normalize(p)));
  if (hit.length) {
    warnings.push(
      `Plan contains cliché phrase(s) the prompt told the AI to avoid: ${hit.join(", ")}.`
    );
  }

  return warnings;
}

async function generateVideoPlan(prompt, durationSec, userId, referenceImage) {
  const configs = await resolveAllAiConfigs(userId);
  if (!configs.length) throw new Error(await generationConfigError(userId));

  const lottieAssets = await listLottieAssetSummaries();
  const lottieAssetIds = lottieAssets.map((asset) => asset.id);
  const lottieAssetPrompt = lottieAssetPromptListFromSummaries(lottieAssets);

  const avoidance = await getAvoidanceHints(userId).catch(() => null);
  const briefing = pickCopyBriefing();
  console.log(
    `[pipeline] copy brief: voice="${briefing.voice.slice(0, 32)}…" hook="${briefing.hook.slice(0, 32)}…" T=${briefing.temperature}`
  );

  let payload, lastErr;
  for (const config of configs) {
    try {
      const genFn = config.provider === "openai" || config.provider === "openrouter"
        ? generateWithOpenAI : generateWithGemini;
      payload = await withRetry(() =>
        genFn(prompt, durationSec, config, userId, "video_generation",
          lottieAssetIds, lottieAssetPrompt, avoidance, briefing, referenceImage)
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
  if (!payload) throw lastErr;

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
export async function runPipeline(projectId, userId, prompt, durationSec, referenceImage) {
  const cost = costForDuration(durationSec);

  try {
    await Project.updateOne(
      { _id: projectId },
      { status: "GENERATING_ASSETS", progress: 10, errorMessage: null }
    );

    const { script, plan } = await generateVideoPlan(prompt, durationSec, userId, referenceImage);

    // Stamp the project's structureSeed (random per-video) and the user's
    // structureSeed onto the plan so the renderer's variant picker derives a
    // unique chrome/grid/align combo every time, even for repeat prompts.
    const projectDoc = await Project.findById(projectId).select("structureSeed");
    const userDoc = await User.findById(userId).select("structureSeed");
    plan.structureSeed = (projectDoc?.structureSeed ?? 0) ^ (userDoc?.structureSeed ?? 0);

    // Persist this video's structural signature on the user so the NEXT
    // generation knows what to avoid. Power-user variety engine.
    await recordVideoSignature(userId, projectId, plan).catch(() => {});

    // ---- CODE-GEN: Generate Remotion JSX code for this video ----
    // The AI writes a complete React component that IS the video. This runs
    // after the JSON plan so we have a fallback, and the script is already
    // written for narration.
    let generatedCode = null;
    try {
      const codeConfigs = await resolveAllAiConfigs(userId);
      if (codeConfigs.length) {
        await Project.updateOne({ _id: projectId }, { progress: 20 });
        let codeLastErr;
        for (const config of codeConfigs) {
          try {
            generatedCode = await withRetry(
              () => generateVideoCode(prompt, durationSec, config, userId, referenceImage),
              3, 2000
            );
            break;
          } catch (err) {
            codeLastErr = err;
            const msg = err instanceof Error ? err.message : String(err);
            if (/\(429\)|\(503\)/.test(msg) && codeConfigs.length > 1) {
              console.warn(`[pipeline] code-gen: ${config.provider} rate-limited, trying next…`);
              continue;
            }
            throw err;
          }
        }
        if (!generatedCode && codeLastErr) throw codeLastErr;
        console.log(`[pipeline] code-gen succeeded for ${projectId} (${generatedCode.length} chars)`);
      }
    } catch (codeErr) {
      // Non-fatal: we still have the JSON plan as fallback.
      console.warn(`[pipeline] code-gen failed for ${projectId}, falling back to JSON plan:`, codeErr.message);
      await Project.updateOne(
        { _id: projectId },
        {
          $push: {
            warnings: {
              $each: [{ phase: "codegen", message: `Code generation failed: ${codeErr.message?.slice(0, 200)}`, at: new Date() }],
              $slice: -10,
            },
          },
        }
      ).catch(() => {});
    }

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
        generatedCode,
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
