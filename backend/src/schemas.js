import { z } from "zod";

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

export const TemplateName = z.enum([
  "saas-product-promo",
  "app-launch",
  "explainer-video",
  "social-reel",
  "local-business",
]);

export const SceneSchema = z.object({
  scene: z.number().int().min(1),
  duration: z.number().min(1).max(15),
  text: z.string().max(140),
  visual: z.string(),
  visualAssetId: z.string().optional(),
  animation: AnimationType,
  transition: TransitionType,
});

export const VideoPlanSchema = z.object({
  duration: z.number().min(5).max(60),
  aspectRatio: AspectRatio,
  template: TemplateName,
  brandColors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
  scenes: z.array(SceneSchema).min(2).max(6),
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
  prompt: z.string().min(10).max(1000),
  durationSec: z.number().int().min(5).max(60).optional().default(20),
});

export const EnhancePromptInput = z.object({
  prompt: z.string().min(5).max(1000),
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

// ---- Static data ----

export const CREDIT_PACKS = [
  { id: "pack_100", credits: 100, priceUsd: 9 },
  { id: "pack_500", credits: 500, priceUsd: 39, popular: true },
  { id: "pack_2000", credits: 2000, priceUsd: 129 },
];
