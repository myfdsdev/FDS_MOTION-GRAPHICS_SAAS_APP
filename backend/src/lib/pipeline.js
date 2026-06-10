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
              // elements removed — AI only writes copy + picks theme/animation
              // /transition. The scene theme owns all the visuals.
              required: [
                "scene",
                "duration",
                "text",
                "sceneTheme",
                "animation",
                "transition",
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
                // elements field removed — themes own the visuals now.
              },
              required: [
                "scene",
                "duration",
                "text",
                "sceneTheme",
                "animation",
                "transition",
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

function systemPrompt(durationSec, lottieAssetPrompt) {
  const lines = [
    "You are a motion-graphics director.",
    "Return only valid JSON that matches the requested schema.",
    `Create a ${durationSec}-second video plan from the user's prompt.`,
    "Use 3 to 5 scenes. Each scene text must be short and suitable for on-screen typography.",
    `Available video categories: ${VIDEO_CATEGORIES.join(", ")}.`,
    `Available scene themes (animated backgrounds): ${SCENE_THEMES.join(", ")}.`,
    `Available animations: ${animations.join(", ")}.`,
    `Available transitions: ${transitions.join(", ")}.`,
    "For every scene, choose one sceneTheme, one animation, and one transition from the allowed lists.",
    "Put the scene's title in `headline`, the subtitle in `subtext`, and the narration in `text`.",
    "No placeholder copy like [Brand Name], Company Name, your brand, or example.com.",
    "No labels inside the script. No markdown.",
    "Color fields (brandColors) MUST be #RRGGBB hex strings only.",
  ];
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
          content: systemPrompt(durationSec, lottieAssetPrompt),
        },
        { role: "user", content: userContent },
      ],
      response_format: responseFormat,
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
  referenceImage
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

  // Build parts — text + optional reference image.
  const parts = [];
  let textPrompt = `${systemPrompt(durationSec, lottieAssetPrompt)}\n\nReturn this JSON shape: {"script":"...","plan":{...}}.\n\nPrompt: ${prompt}`;
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

const CODEGEN_SYSTEM_PROMPT = `You are an elite motion-graphics engineer. You write ONE self-contained Remotion JSX file that produces broadcast-quality animated video by COMPOSING a pre-built component library — NOT by rebuilding components from scratch. The result must look like a hand-crafted After Effects export, never a slideshow of centered text on a gradient.

OUTPUT RULES (non-negotiable):
1. Import animation primitives ONLY from "remotion": AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Series.
2. Import visual building blocks from the library (these already exist — DO NOT redefine them):
   import { RetroGrid, FloatingConfetti, GlowOrb, GlitchTitle, KineticHeadline, NeonButton, EngageRow, StatCounter, DeviceMockup, FeatureCard, CornerBrackets, LightSweep } from "./lib";
   import { getTheme } from "./lib/themes";
   import { ease, mulberry32 } from "./lib/helpers";
3. Export ONE default component. Read duration from useVideoConfig(). NO props.
4. ALL styles inline. No CSS files, Tailwind, or extra imports beyond the two above.
5. You MAY define small scene-wrapper components in-file, but compose visuals from the library — do NOT re-implement grids, confetti, glitch text, buttons, charts, etc.
6. Output ONLY raw JSX. No markdown fences, no prose, no comments outside code.
7. Series.Sequence durations MUST sum to EXACTLY durationInFrames from useVideoConfig().
8. Determinism: seed any randomness with mulberry32(SEED) where SEED is a fixed integer. NEVER Math.random.

OBEY THE CREATIVE CONSTRAINTS:
A "CREATIVE CONSTRAINTS" block is appended to the user brief. You MUST honor every field:
- theme: pass this name to getTheme(name) and use its colors throughout.
- layout: left-anchored | right-anchored | split | diagonal | centered | bottom-third — apply consistently.
- typePersonality: glitch | kinetic | oversized | outlined — pick the matching library title component (GlitchTitle or KineticHeadline).
- signatureMotion: snap-cuts | cinematic-push | parallax-drift | elastic — set pacing and easing to match.
- sceneCount + rhythm: use exactly this many scenes with DELIBERATELY uneven durations (no equal-length scenes).
Different constraints MUST produce visibly different videos. Do not drift toward a default.

VISUAL FLOOR (every scene):
- Background = at least 3 moving layers: a theme gradient base + a structural layer (RetroGrid or GlowOrb cluster) + foreground FloatingConfetti.
- At least one non-text graphic relevant to the topic (DeviceMockup, StatCounter, NeonButton, EngageRow, FeatureCard, or a topic SVG you draw inline).
- Staggered entrances: elements arrive on different frames, never all at once.
- Depth: one blurred GlowOrb behind content, one sharp element in front.
A scene that is only text on a background is a FAILURE — add structure from the library.

COMPONENT API REFERENCE:

RetroGrid: <RetroGrid color={T.gridColor} speed={0.5} position="bottom" />
FloatingConfetti: <FloatingConfetti colors={T.confettiColors} count={25} seed={42} speed={1} />
GlowOrb: <GlowOrb x="50%" y="50%" size={300} color={T.glowColor} blur={80} opacity={0.25} />
GlitchTitle: <GlitchTitle text="Headline" fontSize={72} fontWeight={900} colors={T.titleColors} y="35%" />
KineticHeadline: <KineticHeadline text="Word By Word" fontSize={64} fontWeight={900} color={T.text} y="35%" stagger={4} />
NeonButton: <NeonButton label="Subscribe" color={T.accent} delay={20} x="50%" y="75%" />
EngageRow: <EngageRow likes="12K" comments="840" shares="2.1K" color="#fff" delay={10} y="82%" />
StatCounter: <StatCounter value={10000} suffix="+" label="Active Users" color={T.text} accentColor={T.accent} delay={10} x="50%" y="50%" fontSize={72} />
DeviceMockup: <DeviceMockup type="phone" delay={15} x="50%" y="55%" scale={0.9}>{children}</DeviceMockup>
FeatureCard: <FeatureCard iconPath={svgPath} title="Fast" description="Lightning speed" color={T.accent} bg={T.surface} delay={10} x="50%" y="50%" width={320} />
CornerBrackets: <CornerBrackets color={T.accent} delay={5} />
LightSweep: <LightSweep speed={1} opacity={0.06} />

THEME USAGE:
const T = getTheme("theme-name");
T has: bgTop, bgBottom, glowColor, gridColor, accent, secondary, titleColors, confettiColors, fontFamily, text, muted, surface

SCENE ARCHETYPES (compose, vary order):
HOOK: GlitchTitle or KineticHeadline + FloatingConfetti + CornerBrackets. 1.5-2.5s.
PROOF: StatCounter or FeatureCard over RetroGrid.
DEMO: DeviceMockup(phone|browser) showing the product.
CTA (last scene): NeonButton or EngageRow + confetti burst.

TOPIC TAILORING:
SaaS: DeviceMockup(browser)+FeatureCard. YouTube: NeonButton+EngageRow. Finance: StatCounter. AI/tech: DeviceMockup+GlitchTitle.

OUTPUT: Raw JSX code starting with import statement. Nothing else.`;

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
// Available themes for creative constraints (must match lib/themes.js)
const CODEGEN_THEMES = [
  "midnight-purple", "ocean-blue", "emerald-dark", "sunset-warm",
  "neon-pink", "cyber-green", "fire-red", "arctic-white",
  "gold-luxury", "vibrant-coral",
];
const CODEGEN_LAYOUTS = ["left-anchored", "right-anchored", "split", "diagonal", "centered", "bottom-third"];
const CODEGEN_TYPE_PERSONALITIES = ["glitch", "kinetic", "oversized", "outlined"];
const CODEGEN_MOTIONS = ["snap-cuts", "cinematic-push", "parallax-drift", "elastic"];

function generateCreativeConstraints(prompt, durationSec) {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    hash = ((hash << 5) - hash + prompt.charCodeAt(i)) | 0;
  }
  const pick = (arr, offset = 0) => arr[Math.abs((hash + offset) % arr.length)];
  const sceneCount = durationSec <= 10 ? 3 : durationSec <= 20 ? 4 : 5;
  const totalFrames = durationSec * 30;
  const rhythmParts = [];
  let remaining = totalFrames;
  for (let i = 0; i < sceneCount; i++) {
    if (i === sceneCount - 1) {
      rhythmParts.push(remaining);
    } else {
      const frac = 0.2 + (Math.abs(hash + i * 7) % 15) / 100;
      const frames = Math.round(remaining * frac);
      rhythmParts.push(Math.max(45, frames));
      remaining -= rhythmParts[i];
    }
  }
  return "\n\nCREATIVE CONSTRAINTS:\n" +
    "theme: " + pick(CODEGEN_THEMES, 1) + "\n" +
    "layout: " + pick(CODEGEN_LAYOUTS, 2) + "\n" +
    "typePersonality: " + pick(CODEGEN_TYPE_PERSONALITIES, 3) + "\n" +
    "signatureMotion: " + pick(CODEGEN_MOTIONS, 4) + "\n" +
    "sceneCount: " + sceneCount + "\n" +
    "rhythm: [" + rhythmParts.join(", ") + "] frames (" + rhythmParts.map(f => (f/30).toFixed(1) + "s").join(", ") + ")\n" +
    "totalFrames: " + totalFrames + " (MUST match exactly)";
}

async function generateVideoCode(prompt, durationSec, config, userId, referenceImage) {
  const totalFrames = durationSec * 30;
  const constraints = generateCreativeConstraints(prompt, durationSec);
  const userText = "Create a " + durationSec + "-second (" + totalFrames + " frames at 30fps) motion-graphics video:\n" + prompt + constraints + "\n\nRemember: output ONLY the JSX code, starting with the import statement. No markdown fences.";

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
        max_tokens: 16000,
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
      generationConfig: { temperature: 0.7, maxOutputTokens: 16000 },
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
  let code = raw.trim();
  const fenceMatch = code.match(/^```(?:jsx|javascript|js|tsx)?\n([\s\S]*?)```$/);
  if (fenceMatch) code = fenceMatch[1].trim();
  if (!code.includes("remotion")) {
    throw new Error("Generated code does not import from remotion — invalid output");
  }
  if (!code.includes("export default")) {
    throw new Error("Generated code missing default export — likely truncated");
  }
  const opens = (code.match(/\{/g) || []).length;
  const closes = (code.match(/\}/g) || []).length;
  if (opens > closes + 2) {
    throw new Error("Generated code appears truncated: " + opens + " opening braces vs " + closes + " closing");
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

      // Element handling fully removed — AI no longer generates icons,
      // shapes, charts, or per-element animations. The scene theme owns the
      // visuals. If the user manually adds elements via the editor those
      // still render, but the AI pipeline never produces any.
      delete scene.elements;

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
  // Quality grading removed — was checking AI judgment (narration timing,
  // banned phrases, headline length, visual density). Kept the function so
  // existing call sites keep working but it returns no warnings now.
  void plan; void script; void durationSec;
  return [];
}

async function generateVideoPlan(prompt, durationSec, userId, referenceImage) {
  const configs = await resolveAllAiConfigs(userId);
  if (!configs.length) throw new Error(await generationConfigError(userId));

  const lottieAssets = await listLottieAssetSummaries();
  const lottieAssetIds = lottieAssets.map((asset) => asset.id);
  const lottieAssetPrompt = lottieAssetPromptListFromSummaries(lottieAssets);

  let payload, lastErr;
  for (const config of configs) {
    try {
      const genFn = config.provider === "openai" || config.provider === "openrouter"
        ? generateWithOpenAI : generateWithGemini;
      payload = await withRetry(() =>
        genFn(prompt, durationSec, config, userId, "video_generation",
          lottieAssetIds, lottieAssetPrompt, referenceImage)
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
