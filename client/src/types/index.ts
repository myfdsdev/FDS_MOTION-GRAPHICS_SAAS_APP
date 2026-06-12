// Persisted multi-track timeline produced by the editor. Type-only import
// (erased at build time, so the editorTypes ↔ types cycle is harmless).
import type { SceneElement, Timeline } from "@/lib/editor/editorTypes";
export type {
  Timeline,
  TimelineTrack,
  TimelineClip,
  ZoomRegion,
  SceneElement,
  TextElement,
  IconElement,
  ImageElement,
  ShapeElement,
  LottieElement,
  ElementType,
} from "@/lib/editor/editorTypes";

export type ProjectStatus =
  | "PLANNING"
  | "GENERATING_ASSETS"
  | "READY_TO_EDIT"
  | "QUEUED"
  | "RENDERING"
  | "DONE"
  | "FAILED";

export type AspectRatio = "16:9" | "9:16" | "1:1";

export type AnimationType =
  | "fade-in"
  | "fade-out"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "zoom-in"
  | "zoom-out"
  | "pop-up"
  | "blur-reveal"
  | "typewriter"
  | "fast-zoom"
  | "camera-push";

export type TransitionType = "cut" | "quick-slide" | "zoom-cut" | "fade" | "blur";

export type VideoCategory =
  | "business"
  | "personal"
  | "saas"
  | "marketing"
  | "local-business";

export interface Scene {
  scene: number;
  duration: number;
  text: string;
  headline?: string;
  subtext?: string;
  visual: string;
  sceneTheme?: string;
  lottieAsset?: string;
  lottieAnimationData?: unknown;
  visualAssetId?: string;
  animation: AnimationType;
  transition: TransitionType;
  elements?: SceneElement[];
}

export interface VideoPlan {
  duration: number;
  aspectRatio: AspectRatio;
  category?: VideoCategory;
  brandColors?: string[];
  scenes: Scene[];
  timeline?: Timeline;
  /** Per-video deterministic seed mixed into structural variant picks. */
  structureSeed?: number;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  credits: number;
  isAdmin?: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  prompt: string;
  status: ProjectStatus;
  script?: string;
  sceneJson?: VideoPlan;
  aspectRatio: AspectRatio;
  durationSec: number;
  outputUrl?: string;
  thumbnailUrl?: string;
  voiceoverUrl?: string;
  voiceoverDuration?: number;
  voiceoverError?: string;
  progress: number;
  errorMessage?: string;
  errorPhase?:
    | "load-plan"
    | "attach-lottie"
    | "bundle"
    | "select-composition"
    | "render"
    | "upload"
    | "finalize"
    | "tts"
    | "ai";
  errorCode?: string;
  errorStack?: string;
  errorAt?: string;
  warnings?: { phase?: string; message: string; at?: string }[];
  renderAttempts?: number;
  renderStartedAt?: string;
  renderHeartbeatAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTx {
  id: string;
  delta: number;
  reason: string;
  projectId?: string;
  createdAt: string;
}

export interface CreditPack {
  id: string;
  credits: number;
  priceUsd: number;
  popular?: boolean;
}

export interface ApiKeySummary {
  configured: boolean;
  last4: string | null;
}

export interface ProfileSettings {
  user: User;
  apiKeys: {
    openai: ApiKeySummary;
    gemini: ApiKeySummary;
    openrouter: ApiKeySummary;
    fal: ApiKeySummary;
  };
}

export interface LocalTtsResult {
  provider: "piper";
  url: string;
  path: string;
  fileName: string;
  size: number;
}

export interface AdminSettings {
  allowUserApiKeys: boolean;
}

export interface AdminOverview {
  stats: {
    users: number;
    projects: number;
    doneProjects: number;
    failedProjects: number;
    runningProjects: number;
    creditsIssued: number;
    creditsSpent: number;
  };
  apiUsage: {
    periodStart: string;
    periodEnd: string;
    monthlyTokenLimit: number;
    percentOfLimit: number;
    totalRequests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    lastUsedAt: string | null;
    byProvider: Array<{
      provider: "openai" | "gemini" | "openrouter";
      keySource: "user" | "environment";
      requests: number;
      totalTokens: number;
    }>;
  };
  settings: AdminSettings;
  recentUsers: User[];
  recentProjects: Project[];
}

export interface LottieAssetSummary {
  id: string;
  label: string;
  category: string;
  tags: string[];
  source: "starter" | "uploaded";
  createdAt: string | null;
}

export interface UploadLottieAssetInput {
  id?: string;
  label: string;
  category: string;
  tags?: string[];
  animationData: Record<string, unknown>;
}
