import type {
  CreditPack,
  CreditTx,
  Project,
  ProjectStatus,
  User,
  VideoPlan,
} from "@/types";

// ---------- Persistent mock store (keeps state across navigations) ----------

const STORAGE_KEY = "mock_db_v1";

interface MockDB {
  user: User | null;
  projects: Project[];
  transactions: CreditTx[];
}

const seedUser: User = {
  id: "user_demo",
  email: "demo@aivideo.app",
  name: "Demo Creator",
  credits: 30,
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
};

const seedPlan: VideoPlan = {
  duration: 20,
  aspectRatio: "16:9",
  template: "saas-product-promo",
  brandColors: ["#0a0a0a", "#8b5cf6"],
  scenes: [
    {
      scene: 1,
      duration: 5,
      text: "Still creating videos manually?",
      visual: "dark background with animated icons",
      animation: "fade-in",
      transition: "quick-slide",
    },
    {
      scene: 2,
      duration: 5,
      text: "Let AI build them for you.",
      visual: "AI dashboard mockup",
      animation: "slide-up",
      transition: "zoom-cut",
    },
    {
      scene: 3,
      duration: 5,
      text: "Polished motion graphics in seconds.",
      visual: "motion graphic preview cards",
      animation: "zoom-in",
      transition: "fade",
    },
    {
      scene: 4,
      duration: 5,
      text: "Try it free today.",
      visual: "CTA with logo",
      animation: "pop-up",
      transition: "cut",
    },
  ],
};

const seedProjects: Project[] = [
  {
    id: "proj_001",
    userId: "user_demo",
    prompt: "Launch video for an AI SaaS called Nimbus that helps designers ship faster",
    status: "DONE",
    sceneJson: seedPlan,
    template: "saas-product-promo",
    aspectRatio: "16:9",
    durationSec: 20,
    outputUrl: "https://example.com/videos/proj_001.mp4",
    thumbnailUrl: "",
    progress: 100,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: "proj_002",
    userId: "user_demo",
    prompt: "30 second explainer for a project management tool with team features",
    status: "DONE",
    sceneJson: seedPlan,
    template: "explainer-video",
    aspectRatio: "16:9",
    durationSec: 30,
    outputUrl: "https://example.com/videos/proj_002.mp4",
    thumbnailUrl: "",
    progress: 100,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "proj_003",
    userId: "user_demo",
    prompt: "Instagram reel announcing our Black Friday sale",
    status: "FAILED",
    template: "social-reel",
    aspectRatio: "9:16",
    durationSec: 15,
    progress: 45,
    errorMessage: "Asset generation timed out",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
];

const seedTransactions: CreditTx[] = [
  {
    id: "tx_1",
    delta: 30,
    reason: "signup_bonus",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: "tx_2",
    delta: -10,
    reason: "render",
    projectId: "proj_001",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: "tx_3",
    delta: -20,
    reason: "render",
    projectId: "proj_002",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
];

function loadDB(): MockDB {
  if (typeof window === "undefined") {
    return { user: null, projects: [], transactions: [] };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockDB;
  } catch {
    // ignore
  }
  return { user: null, projects: [], transactions: [] };
}

function saveDB(db: MockDB) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore
  }
}

let db: MockDB = loadDB();

// ---------- Helpers ----------

function delay(ms = 250) {
  return new Promise((r) => setTimeout(r, ms));
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- Public mock API ----------

export const mockApi = {
  async getMe(): Promise<User | null> {
    await delay(100);
    return db.user;
  },

  async login(email: string, _password: string): Promise<User> {
    await delay(400);
    const user: User = {
      ...seedUser,
      email,
      name: email.split("@")[0],
    };
    db.user = user;
    db.projects = [...seedProjects];
    db.transactions = [...seedTransactions];
    saveDB(db);
    return user;
  },

  async register(email: string, _password: string, name: string): Promise<User> {
    await delay(500);
    const user: User = {
      id: newId("user"),
      email,
      name,
      credits: 30,
      createdAt: new Date().toISOString(),
    };
    db.user = user;
    db.projects = [];
    db.transactions = [
      {
        id: newId("tx"),
        delta: 30,
        reason: "signup_bonus",
        createdAt: new Date().toISOString(),
      },
    ];
    saveDB(db);
    return user;
  },

  async logout(): Promise<void> {
    await delay(100);
    db = { user: null, projects: [], transactions: [] };
    saveDB(db);
  },

  async listProjects(): Promise<Project[]> {
    await delay(200);
    return [...db.projects].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getProject(id: string): Promise<Project> {
    await delay(150);
    const proj = db.projects.find((p) => p.id === id);
    if (!proj) throw new Error("Project not found");

    // Advance status of "in-progress" projects to simulate background work
    if (proj.status !== "DONE" && proj.status !== "FAILED") {
      const flow: ProjectStatus[] = [
        "PLANNING",
        "GENERATING_ASSETS",
        "QUEUED",
        "RENDERING",
        "DONE",
      ];
      const idx = flow.indexOf(proj.status);
      const elapsed = Date.now() - new Date(proj.updatedAt).getTime();

      if (proj.status === "RENDERING") {
        proj.progress = Math.min(100, proj.progress + 8);
        if (proj.progress >= 100) {
          proj.status = "DONE";
          proj.outputUrl = `https://example.com/videos/${proj.id}.mp4`;
          proj.updatedAt = new Date().toISOString();
        }
      } else if (elapsed > 1500 && idx < flow.length - 1) {
        proj.status = flow[idx + 1];
        proj.progress = idx === 2 ? 5 : Math.max(proj.progress, idx * 15);
        proj.updatedAt = new Date().toISOString();

        if (proj.status === "DONE") {
          proj.outputUrl = `https://example.com/videos/${proj.id}.mp4`;
          proj.progress = 100;
        }
      }
      saveDB(db);
    }

    return { ...proj };
  },

  async createProject(prompt: string, durationSec = 20): Promise<Project> {
    await delay(600);
    if (!db.user) throw new Error("Not authenticated");
    const cost = durationSec >= 30 ? 20 : 10;
    if (db.user.credits < cost) throw new Error("Not enough credits");

    db.user.credits -= cost;
    const proj: Project = {
      id: newId("proj"),
      userId: db.user.id,
      prompt,
      status: "PLANNING",
      template: "saas-product-promo",
      aspectRatio: "16:9",
      durationSec,
      sceneJson: seedPlan,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.projects.unshift(proj);
    db.transactions.unshift({
      id: newId("tx"),
      delta: -cost,
      reason: "render",
      projectId: proj.id,
      createdAt: new Date().toISOString(),
    });
    saveDB(db);
    return proj;
  },

  async deleteProject(id: string): Promise<void> {
    await delay(200);
    db.projects = db.projects.filter((p) => p.id !== id);
    saveDB(db);
  },

  async rerender(id: string): Promise<Project> {
    await delay(400);
    const proj = db.projects.find((p) => p.id === id);
    if (!proj) throw new Error("Project not found");
    proj.status = "PLANNING";
    proj.progress = 0;
    proj.outputUrl = undefined;
    proj.errorMessage = undefined;
    proj.updatedAt = new Date().toISOString();
    saveDB(db);
    return { ...proj };
  },

  async enhancePrompt(prompt: string): Promise<string> {
    await delay(800);
    return `${prompt.trim()} — make it cinematic, modern, with bold typography, energetic transitions, and a clear call-to-action at the end.`;
  },

  async listTransactions(): Promise<CreditTx[]> {
    await delay(150);
    return [...db.transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getCreditPacks(): Promise<CreditPack[]> {
    await delay(80);
    return [
      { id: "pack_100", credits: 100, priceUsd: 9 },
      { id: "pack_500", credits: 500, priceUsd: 39, popular: true },
      { id: "pack_2000", credits: 2000, priceUsd: 129 },
    ];
  },

  async topUp(packId: string): Promise<User> {
    await delay(800);
    if (!db.user) throw new Error("Not authenticated");
    const map: Record<string, number> = {
      pack_100: 100,
      pack_500: 500,
      pack_2000: 2000,
    };
    const credits = map[packId] ?? 0;
    db.user.credits += credits;
    db.transactions.unshift({
      id: newId("tx"),
      delta: credits,
      reason: "stripe_topup",
      createdAt: new Date().toISOString(),
    });
    saveDB(db);
    return { ...db.user };
  },
};
