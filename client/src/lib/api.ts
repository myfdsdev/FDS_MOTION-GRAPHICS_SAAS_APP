import type {
  AdminOverview,
  CreditPack,
  CreditTx,
  ProfileSettings,
  Project,
  User,
} from "@/types";
import { mockApi } from "@/mocks/db";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

async function realFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
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
  durationSec = 20
): Promise<Project> {
  if (USE_MOCKS) return mockApi.createProject(prompt, durationSec);
  return realFetch<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ prompt, durationSec }),
  });
}

export async function deleteProject(id: string): Promise<void> {
  if (USE_MOCKS) return mockApi.deleteProject(id);
  await realFetch<void>(`/api/projects/${id}`, { method: "DELETE" });
}

export async function rerenderProject(id: string): Promise<Project> {
  if (USE_MOCKS) return mockApi.rerender(id);
  return realFetch<Project>(`/api/projects/${id}/rerender`, { method: "POST" });
}

export async function enhancePrompt(prompt: string): Promise<string> {
  if (USE_MOCKS) return mockApi.enhancePrompt(prompt);
  const res = await realFetch<{ prompt: string }>("/api/enhance-prompt", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
  return res.prompt;
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
      recentUsers: user ? [user] : [],
      recentProjects: projects,
    };
  }
  return realFetch<AdminOverview>("/api/admin/overview");
}

export { USE_MOCKS };
