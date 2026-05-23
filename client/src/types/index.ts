export type ProjectStatus =
  | "PLANNING"
  | "GENERATING_ASSETS"
  | "QUEUED"
  | "RENDERING"
  | "DONE"
  | "FAILED";

export type AspectRatio = "16:9" | "9:16" | "1:1";

export type TemplateName =
  | "saas-product-promo"
  | "app-launch"
  | "explainer-video"
  | "social-reel"
  | "local-business";

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

export interface Scene {
  scene: number;
  duration: number;
  text: string;
  visual: string;
  visualAssetId?: string;
  animation: AnimationType;
  transition: TransitionType;
}

export interface VideoPlan {
  duration: number;
  aspectRatio: AspectRatio;
  template: TemplateName;
  brandColors?: string[];
  scenes: Scene[];
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
  template?: TemplateName;
  aspectRatio: AspectRatio;
  durationSec: number;
  outputUrl?: string;
  thumbnailUrl?: string;
  progress: number;
  errorMessage?: string;
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
    fal: ApiKeySummary;
  };
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
  recentUsers: User[];
  recentProjects: Project[];
}
