import type {
  AdminOverview,
  AdminSettings,
  AssistantChatResult,
  CreditPack,
  CreditTx,
  LottieAssetSummary,
  LocalTtsResult,
  ProfileSettings,
  Project,
  AspectRatio,
  UploadLottieAssetInput,
  User,
  VideoPlan,
} from "@/types";
import { mockApi } from "@/mocks/db";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

// Base URL of the backend API. Leave empty for same-origin (dev uses the Vite
// proxy; same-server prod serves both). Set VITE_API_BASE_URL to an absolute
// origin (e.g. https://fds-...onrender.com) for a split frontend/API deploy.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

function apiUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  const apiPath = path.startsWith("/") ? path : `/${path}`;

  if (!API_BASE_URL) return apiPath;
  if (API_BASE_URL.endsWith("/api") && apiPath.startsWith("/api/")) {
    return `${API_BASE_URL}${apiPath.slice(4)}`;
  }

  return `${API_BASE_URL}${apiPath}`;
}

// Starter animations removed — the library is populated only by admin uploads.
const mockUploadedLottieAssets: LottieAssetSummary[] = [];
const mockStarterLottieAssets: LottieAssetSummary[] = [];

async function realFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  // 204 No Content (e.g. logout, delete) and other empty bodies have no JSON.
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------- Auth ----------

export async function getMe(): Promise<User | null> {
  if (USE_MOCKS) return mockApi.getMe();
  try {
    return await realFetch<User>("/api/auth/me");
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<User> {
  if (USE_MOCKS) return mockApi.login(email, password);
  return realFetch<User>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<User> {
  if (USE_MOCKS) return mockApi.register(email, password, name);
  return realFetch<User>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export async function logout(): Promise<void> {
  if (USE_MOCKS) return mockApi.logout();
  await realFetch<void>("/api/auth/logout", { method: "POST" });
}

// ---------- Profile ----------

export async function getProfile(): Promise<ProfileSettings> {
  if (USE_MOCKS) {
    const user = await mockApi.getMe();
    if (!user) throw new Error("Not authenticated");
    return {
      user,
      apiKeys: {
        openai: { configured: false, last4: null },
        gemini: { configured: false, last4: null },
        openrouter: { configured: false, last4: null },
        fal: { configured: false, last4: null },
      },
    };
  }
  return realFetch<ProfileSettings>("/api/profile");
}

export async function updateProfile(input: {
  name?: string | null;
  apiKeys?: {
    openai?: string;
    gemini?: string;
    fal?: string;
  };
}): Promise<ProfileSettings> {
  if (USE_MOCKS) return getProfile();
  return realFetch<ProfileSettings>("/api/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ---------- Projects ----------

export async function listProjects(): Promise<Project[]> {
  if (USE_MOCKS) return mockApi.listProjects();
  return realFetch<Project[]>("/api/projects");
}

export async function getProject(id: string): Promise<Project> {
  if (USE_MOCKS) return mockApi.getProject(id);
  return realFetch<Project>(`/api/projects/${id}`);
}

export async function createProject(
  prompt: string,
  durationSec = 20,
  referenceImage?: string,
  aspectRatio?: AspectRatio
): Promise<Project> {
  if (USE_MOCKS) return mockApi.createProject(prompt, durationSec, aspectRatio);
  return realFetch<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      durationSec,
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(referenceImage ? { referenceImage } : {}),
    }),
  });
}

export async function deleteProject(id: string): Promise<void> {
  if (USE_MOCKS) return mockApi.deleteProject(id);
  await realFetch<void>(`/api/projects/${id}`, { method: "DELETE" });
}

export async function updateProject(
  id: string,
  input: { sceneJson?: VideoPlan }
): Promise<Project> {
  if (USE_MOCKS) return mockApi.getProject(id);
  return realFetch<Project>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function rerenderProject(id: string): Promise<Project> {
  if (USE_MOCKS) return mockApi.rerender(id);
  return realFetch<Project>(`/api/projects/${id}/rerender`, { method: "POST" });
}

export async function generateProject(
  id: string,
  prompt: string,
  durationSec?: number,
  referenceImage?: string
): Promise<Project> {
  if (USE_MOCKS) return mockApi.getProject(id);
  return realFetch<Project>(`/api/projects/${id}/generate`, {
    method: "POST",
    body: JSON.stringify({
      prompt,
      ...(durationSec ? { durationSec } : {}),
      ...(referenceImage ? { referenceImage } : {}),
    }),
  });
}

export async function enhancePrompt(prompt: string): Promise<string> {
  if (USE_MOCKS) return mockApi.enhancePrompt(prompt);
  const res = await realFetch<{ prompt: string }>("/api/enhance-prompt", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
  return res.prompt;
}

export async function askAssistant(message: string): Promise<AssistantChatResult> {
  if (USE_MOCKS) {
    const { isVideoAssistantTopic, VIDEO_ASSISTANT_SCOPE_MESSAGE } = await import("@/lib/domainGuard");
    return {
      reply: isVideoAssistantTopic(message)
        ? "I can help with that. For best results, describe the target format, audience, timing, visual style, narration, and the exact render problem or video goal."
        : VIDEO_ASSISTANT_SCOPE_MESSAGE,
    };
  }
  return realFetch<AssistantChatResult>("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ---------- Local TTS ----------

export async function generateLocalTts(text: string): Promise<LocalTtsResult> {
  return realFetch<LocalTtsResult>("/api/local-tts/generate", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

// ---------- Billing ----------

export async function listTransactions(): Promise<CreditTx[]> {
  if (USE_MOCKS) return mockApi.listTransactions();
  return realFetch<CreditTx[]>("/api/billing/transactions");
}

export async function getCreditPacks(): Promise<CreditPack[]> {
  if (USE_MOCKS) return mockApi.getCreditPacks();
  return realFetch<CreditPack[]>("/api/billing/packs");
}

export async function topUp(packId: string): Promise<User> {
  if (USE_MOCKS) return mockApi.topUp(packId);
  return realFetch<User>("/api/stripe/checkout", {
    method: "POST",
    body: JSON.stringify({ packId }),
  });
}

// ---------- Admin ----------

export async function getAdminOverview(): Promise<AdminOverview> {
  if (USE_MOCKS) {
    const projects = await mockApi.listProjects();
    const user = await mockApi.getMe();
    return {
      stats: {
        users: user ? 1 : 0,
        projects: projects.length,
        doneProjects: projects.filter((p) => p.status === "DONE").length,
        failedProjects: projects.filter((p) => p.status === "FAILED").length,
        runningProjects: projects.filter(
          (p) => !["DONE", "FAILED"].includes(p.status)
        ).length,
        creditsIssued: user?.credits ?? 0,
        creditsSpent: 0,
      },
      apiUsage: {
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        periodEnd: new Date().toISOString(),
        monthlyTokenLimit: 1_000_000,
        percentOfLimit: 12,
        totalRequests: 18,
        inputTokens: 84_200,
        outputTokens: 38_600,
        totalTokens: 122_800,
        lastUsedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        byProvider: [
          {
            provider: "openai",
            keySource: "user",
            requests: 12,
            totalTokens: 91_400,
          },
          {
            provider: "gemini",
            keySource: "environment",
            requests: 6,
            totalTokens: 31_400,
          },
        ],
      },
      settings: {
        allowUserApiKeys: true,
      },
      recentUsers: user ? [user] : [],
      recentProjects: projects,
    };
  }
  return realFetch<AdminOverview>("/api/admin/overview");
}

export async function updateAdminSettings(input: Partial<AdminSettings>): Promise<AdminSettings> {
  if (USE_MOCKS) {
    return {
      allowUserApiKeys: input.allowUserApiKeys ?? true,
    };
  }

  return realFetch<AdminSettings>("/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface ProviderKeySummary {
  id: string;
  label: string;
  category: string;
  configured: boolean;
  source: "db" | "env" | null;
  last4: string | null;
}

export async function getProviderKeys(): Promise<ProviderKeySummary[]> {
  if (USE_MOCKS) return [];
  const data = await realFetch<{ providers: ProviderKeySummary[] }>("/api/admin/provider-keys");
  return data.providers;
}

export async function saveProviderKeys(
  keys: Record<string, string>
): Promise<ProviderKeySummary[]> {
  if (USE_MOCKS) return [];
  const data = await realFetch<{ providers: ProviderKeySummary[] }>("/api/admin/provider-keys", {
    method: "PUT",
    body: JSON.stringify({ keys }),
  });
  return data.providers;
}

export interface ProviderModelSummary {
  id: string;
  label: string;
  provider: string;
  group: string;
  value: string;
  source: "db" | "env" | "default";
  default: string;
}

export async function getProviderModels(): Promise<ProviderModelSummary[]> {
  if (USE_MOCKS) return [];
  const data = await realFetch<{ models: ProviderModelSummary[] }>("/api/admin/provider-models");
  return data.models;
}

export async function saveProviderModels(
  models: Record<string, string>
): Promise<ProviderModelSummary[]> {
  if (USE_MOCKS) return [];
  const data = await realFetch<{ models: ProviderModelSummary[] }>("/api/admin/provider-models", {
    method: "PUT",
    body: JSON.stringify({ models }),
  });
  return data.models;
}

function mockSlug(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");

  return slug.length >= 3 ? slug : "custom-animation";
}

export async function listLottieAssets(): Promise<LottieAssetSummary[]> {
  if (USE_MOCKS) return [...mockUploadedLottieAssets, ...mockStarterLottieAssets];
  return realFetch<LottieAssetSummary[]>("/api/admin/lottie-assets");
}

export async function getLottieAnimation(id: string): Promise<Record<string, unknown> | null> {
  if (USE_MOCKS) return null;
  try {
    // Public (auth-only) endpoint — works for non-admin users so the editor
    // canvas can render Lottie elements. AdminPage uses the same function.
    const res = await realFetch<{ animationData: Record<string, unknown> }>(
      `/api/lottie-assets/${id}/animation`
    );
    return res.animationData;
  } catch {
    return null;
  }
}

export async function uploadLottieAsset(
  input: UploadLottieAssetInput
): Promise<LottieAssetSummary> {
  if (USE_MOCKS) {
    const asset: LottieAssetSummary = {
      id: mockSlug(input.id || `custom-${input.label}-${mockUploadedLottieAssets.length + 1}`),
      label: input.label,
      category: input.category,
      tags: input.tags ?? [],
      source: "uploaded",
      createdAt: new Date().toISOString(),
    };
    mockUploadedLottieAssets.unshift(asset);
    return asset;
  }

  return realFetch<LottieAssetSummary>("/api/admin/lottie-assets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export { USE_MOCKS };
