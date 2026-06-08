import { z } from "zod";
import {
  SCENE_THEMES,
  VIDEO_CATEGORIES,
} from "./lib/videoAssets.js";

// ---- Scene / video plan (matches the frontend contract) ----

export const AnimationType = z.enum([
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
]);

export const TransitionType = z.enum(["cut", "quick-slide", "zoom-cut", "fade", "blur"]);

export const AspectRatio = z.enum(["16:9", "9:16", "1:1"]);

export const VideoCategory = z.enum(VIDEO_CATEGORIES);

// Lottie library categories are admin-defined, so accept any short slug
// (lowercased, spaces → hyphens). Unlike VideoCategory this is not a fixed enum.
export const LottieCategory = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .transform((s) =>
    s
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  )
  .refine((s) => s.length >= 2, "Category must be at least 2 characters");

export const SceneTheme = z.enum(SCENE_THEMES);

export const LottieAssetId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);

// ---- Direct-manipulation scene elements (fractional 0..1 positions) ----

const Hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
const Frac = z.number().min(-1).max(2); // allow slight off-canvas overflow

const ElementAnimationKind = z.enum([
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
  "zoom-in",
  "zoom-out",
  "scale",
  "pop",
]);
const ElementAnimationStep = z.object({
  kind: ElementAnimationKind,
  at: z.number().min(0).max(600),
  duration: z.number().min(0.05).max(60),
});
const ElementAnimationSchema = z.object({
  in: ElementAnimationStep.optional(),
  out: ElementAnimationStep.optional(),
});

const ElementBase = {
  id: z.string().min(1).max(80),
  x: Frac,
  y: Frac,
  w: z.number().min(0).max(3),
  h: z.number().min(0).max(3),
  rotation: z.number().min(-360).max(360).default(0),
  z: z.number().int().min(0).max(9999).default(0),
  name: z.string().max(120).optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  animation: ElementAnimationSchema.optional(),
};

export const SceneElementSchema = z.discriminatedUnion("type", [
  z.object({
    ...ElementBase,
    type: z.literal("text"),
    text: z.string().max(1000),
    font: z.string().max(80).optional(),
    size: z.number().min(0.005).max(1).optional(),
    weight: z.number().int().min(100).max(900).optional(),
    color: Hex.optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    lineHeight: z.number().min(0.5).max(4).optional(),
  }),
  z.object({
    ...ElementBase,
    type: z.literal("icon"),
    name: z.string().max(60),
    color: Hex.optional(),
  }),
  z.object({
    ...ElementBase,
    type: z.literal("image"),
    src: z.string().max(2000),
    fit: z.enum(["cover", "contain"]).optional(),
  }),
  z.object({
    ...ElementBase,
    type: z.literal("shape"),
    shape: z.enum(["rect", "ellipse"]),
    fill: Hex.optional(),
    stroke: Hex.optional(),
    strokeWidth: z.number().min(0).max(100).optional(),
    radius: z.number().min(0).max(500).optional(),
  }),
  z.object({
    ...ElementBase,
    // Inline SVG illustration. The AI generates a custom SVG graphic relevant
    // to the topic (laptop, chart, phone mockup, etc.). Rendered as raw SVG
    // inside the element's bounding box. viewBox defaults to "0 0 200 200".
    type: z.literal("svg"),
    // Raw SVG inner content (paths, circles, rects — no outer <svg> tag).
    paths: z.string().max(5000),
    viewBox: z.string().max(40).optional(),
    stroke: Hex.optional(),
    fill: Hex.optional(),
    strokeWidth: z.number().min(0).max(20).optional(),
  }),
  z.object({
    ...ElementBase,
    // Decorative animated gradient orb / glow. Renders as a soft blurred
    // circle that floats/drifts. Used for ambient background decoration.
    type: z.literal("glow"),
    color: Hex.optional(),
    blur: z.number().min(10).max(200).optional(),
    pulse: z.boolean().optional(),
  }),
  z.object({
    ...ElementBase,
    // Animated progress/percentage ring. Draws an SVG donut that fills to
    // the target percentage with an animated stroke.
    type: z.literal("progress-ring"),
    value: z.number().min(0).max(100),
    label: z.string().max(80).optional(),
    color: Hex.optional(),
    trackColor: Hex.optional(),
    thickness: z.number().min(2).max(30).optional(),
    animationDuration: z.number().min(0.2).max(10).optional(),
  }),
  z.object({
    ...ElementBase,
    type: z.literal("lottie"),
    assetId: LottieAssetId.optional(),
    animationData: z.unknown().optional(),
    speed: z.number().min(0.1).max(4).optional(),
    loop: z.boolean().optional(),
  }),
  z.object({
    ...ElementBase,
    // Animated horizontal bar chart. Bars grow from 0 to their target value
    // in sequence, title/subtitle fade in, percentages count up alongside.
    type: z.literal("bar-chart"),
    title: z.string().max(160).optional(),
    subtitle: z.string().max(300).optional(),
    rows: z
      .array(
        z.object({
          label: z.string().max(120),
          value: z.number().min(0).max(10000),
        })
      )
      .min(1)
      .max(12),
    bg: Hex.optional(),
    fg: Hex.optional(),
    bar: Hex.optional(),
    axisMax: z.number().min(1).max(10000).optional(),
    showAxis: z.boolean().optional(),
    showValues: z.boolean().optional(),
    valueSuffix: z.string().max(8).optional(),
    titleFont: z.string().max(80).optional(),
    labelFont: z.string().max(80).optional(),
    animationDuration: z.number().min(0.2).max(60).optional(),
    startDelay: z.number().min(0).max(60).optional(),
  }),
  // ---- Growth / line chart ----------------------------------------------
  // An animated line trace + filled area going up-and-to-the-right (or any
  // shape, but the AI prompt steers it toward growth). Each point is drawn
  // as the line "draws itself" left-to-right; the value badge counts up at
  // the end.
  z.object({
    ...ElementBase,
    type: z.literal("line-chart"),
    title: z.string().max(160).optional(),
    subtitle: z.string().max(300).optional(),
    points: z
      .array(
        z.object({
          label: z.string().max(40).optional(),
          value: z.number().min(0).max(10000),
        })
      )
      .min(2)
      .max(20),
    bg: Hex.optional(),
    fg: Hex.optional(),
    line: Hex.optional(),
    fill: Hex.optional(),
    showGrid: z.boolean().optional(),
    showAxis: z.boolean().optional(),
    valueSuffix: z.string().max(8).optional(),
    valuePrefix: z.string().max(8).optional(),
    finalValue: z.number().min(0).max(1e9).optional(),
    finalLabel: z.string().max(40).optional(),
    animationDuration: z.number().min(0.2).max(60).optional(),
  }),
  // ---- Stat tile --------------------------------------------------------
  // Big number + label + optional caption + optional tiny sparkline. The
  // single most reused element in explainer videos ("$1.2M ARR", "98%
  // retention", "4× faster").
  z.object({
    ...ElementBase,
    type: z.literal("stat"),
    value: z.number().min(-1e9).max(1e9),
    valuePrefix: z.string().max(8).optional(),
    valueSuffix: z.string().max(8).optional(),
    label: z.string().max(120).optional(),
    caption: z.string().max(160).optional(),
    bg: Hex.optional(),
    fg: Hex.optional(),
    accent: Hex.optional(),
    // Optional inline sparkline data — drawn under the number.
    sparkline: z.array(z.number()).min(2).max(40).optional(),
    /** Animate the number counting up from 0 to value. Default true. */
    countUp: z.boolean().optional(),
    animationDuration: z.number().min(0.2).max(60).optional(),
  }),
  z.object({
    ...ElementBase,
    // Karaoke-style live subtitles. Each word highlights in `accent` while
    // it's being read, past words use `color`, future words are dimmed.
    type: z.literal("subtitle"),
    text: z.string().max(2000),
    font: z.string().max(80).optional(),
    // Font size as a fraction of composition HEIGHT.
    size: z.number().min(0.005).max(1).optional(),
    weight: z.number().int().min(100).max(900).optional(),
    // Color for past (already-spoken) words.
    color: Hex.optional(),
    // Color for the word currently being spoken.
    accent: Hex.optional(),
    // Opacity 0..1 for future (not-yet-spoken) words.
    futureOpacity: z.number().min(0).max(1).optional(),
    // Total spoken duration (seconds). When omitted the renderer falls
    // back to the containing scene/clip duration.
    duration: z.number().min(0.1).max(600).optional(),
    // Optional forced-alignment data (seconds relative to subtitle start).
    wordTimings: z
      .array(
        z.object({
          word: z.string().min(1).max(80),
          start: z.number().min(0).max(600),
          end: z.number().min(0).max(600),
        })
      )
      .max(400)
      .optional(),
  }),
]);

export const SceneSchema = z.object({
  scene: z.number().int().min(1),
  duration: z.number().min(0.1).max(600),
  // `text` is the per-scene NARRATION chunk — at 150 wpm a 10-second scene
  // is ~25 words ≈ 175 chars, so 140 was too tight and kept failing Zod.
  // Bumped to 800 with safe truncation in sanitizePlan as belt-and-suspenders.
  text: z.string().max(800),
  headline: z.string().max(140).optional(),
  subtext: z.string().max(240).optional(),
  visual: z.string(),
  sceneTheme: SceneTheme.optional(),
  // Optional per-word timing for karaoke-subtitle template. When absent the
  // template falls back to a character-length-weighted even split derived
  // from `text` + `duration`. Future forced-alignment can populate this.
  wordTimings: z
    .array(
      z.object({
        word: z.string().min(1).max(80),
        start: z.number().min(0).max(600),
        end: z.number().min(0).max(600),
      })
    )
    .max(400)
    .optional(),
  lottieAsset: LottieAssetId.optional(),
  lottieAnimationData: z.unknown().optional(),
  visualAssetId: z.string().optional(),
  animation: AnimationType,
  transition: TransitionType,
  elements: z.array(SceneElementSchema).max(50).optional(),
});

// ---- Multi-track editor timeline (optional; persisted on VideoPlan.timeline) ----

export const ZoomRegionSchema = z.object({
  id: z.string().min(1).max(80),
  start: z.number().min(0).max(600),
  end: z.number().min(0).max(600),
  scale: z.number().min(1).max(4),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
});

export const TimelineClipSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(["scene", "text", "image", "audio"]),
  start: z.number().min(0).max(600),
  duration: z.number().min(0.1).max(600),
  trimStart: z.number().min(0).max(600).optional(),
  volume: z.number().min(0).max(1).optional(),
  animation: AnimationType.optional(),
  transition: TransitionType.optional(),
  scene: SceneSchema.optional(),
  text: z.string().max(500).optional(),
  src: z.string().max(2000).optional(),
  label: z.string().max(200).optional(),
});

export const TimelineTrackSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["scene", "overlay", "audio"]),
  name: z.string().max(80).optional(),
  muted: z.boolean().optional(),
  clips: z.array(TimelineClipSchema).max(200),
});

export const TimelineSchema = z.object({
  fps: z.number().int().min(1).max(120),
  duration: z.number().min(0.1).max(600),
  tracks: z.array(TimelineTrackSchema).max(20),
  zoomRegions: z.array(ZoomRegionSchema).max(50),
});

export const VideoPlanSchema = z.object({
  duration: z.number().min(1).max(600),
  aspectRatio: AspectRatio,
  category: VideoCategory.optional(),
  brandColors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
  scenes: z.array(SceneSchema).min(1).max(50),
  timeline: TimelineSchema.optional(),
  // Per-video deterministic seed (random at creation) mixed into the
  // renderer's structural variant picker. Same plan + same seed = identical
  // output; same prompt + new seed = visibly different structure. Critical
  // for power-user variety.
  structureSeed: z.number().int().optional(),
});

export const UpdateProjectInput = z.object({
  sceneJson: VideoPlanSchema,
});

// ---- API request inputs ----

export const RegisterInput = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  name: z.string().min(2).max(80),
});

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const CreateProjectInput = z.object({
  prompt: z.string().min(10).max(5000),
  durationSec: z.number().int().min(5).max(60).optional().default(20),
  referenceImage: z.string().max(6_000_000).optional(),
});

export const EnhancePromptInput = z.object({
  prompt: z.string().min(5).max(5000),
});

export const GenerateProjectInput = z.object({
  prompt: z.string().min(10).max(5000),
  durationSec: z.number().int().min(5).max(60).optional(),
  /** Base64 data-URL of a reference image for layout/style extraction. */
  referenceImage: z.string().max(6_000_000).optional(),
});

export const TopUpInput = z.object({
  packId: z.enum(["pack_100", "pack_500", "pack_2000"]),
});

export const PresignInput = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

export const UpdateProfileInput = z.object({
  name: z.string().min(2).max(80).nullable().optional(),
  apiKeys: z
    .object({
      openai: z.string().max(300).optional(),
      gemini: z.string().max(300).optional(),
      fal: z.string().max(300).optional(),
    })
    .optional(),
});

export const UpdateAdminSettingsInput = z.object({
  allowUserApiKeys: z.boolean().optional(),
});

export const LottieAnimationDataInput = z
  .object({
    fr: z.number().positive(),
    op: z.number().positive(),
    w: z.number().positive(),
    h: z.number().positive(),
    layers: z.array(z.unknown()),
  })
  .passthrough();

export const CreateLottieAssetInput = z.object({
  id: LottieAssetId.optional(),
  label: z.string().trim().min(2).max(80),
  category: LottieCategory.default("business"),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).optional().default([]),
  animationData: LottieAnimationDataInput,
});

// ---- Static data ----

export const CREDIT_PACKS = [
  { id: "pack_100", credits: 100, priceUsd: 9 },
  { id: "pack_500", credits: 500, priceUsd: 39, popular: true },
  { id: "pack_2000", credits: 2000, priceUsd: 129 },
];
