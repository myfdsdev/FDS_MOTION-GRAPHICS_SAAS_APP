import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  KeyRound,
  Library,
  Loader2,
  UploadCloud,
  Users,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  useAdminOverview,
  useLottieAssets,
  useMe,
  useUpdateAdminSettings,
  useUploadLottieAsset,
} from "@/lib/queries";
import { formatRelativeTime } from "@/lib/utils";
import type { VideoCategory } from "@/types";

const statCards = [
  { key: "users", label: "Users", icon: Users },
  { key: "projects", label: "Projects", icon: Activity },
  { key: "doneProjects", label: "Done", icon: CheckCircle2 },
  { key: "failedProjects", label: "Failed", icon: AlertTriangle },
] as const;

const numberFormat = new Intl.NumberFormat("en");
const lottieCategories: VideoCategory[] = [
  "business",
  "personal",
  "saas",
  "marketing",
  "local-business",
];

function formatNumber(value: number) {
  return numberFormat.format(value || 0);
}

function formatProvider(provider: string) {
  return provider === "openai" ? "OpenAI" : "Gemini";
}

function formatKeySource(source: string) {
  return source === "user" ? "User key" : "Server key";
}

function formatCategory(category: string) {
  return category.replace("-", " ");
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatUsagePeriod(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${endDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

export default function AdminPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const isAdmin = Boolean(me?.isAdmin);
  const { data, isLoading } = useAdminOverview(isAdmin);
  const { data: lottieAssets = [], isLoading: lottieLoading } = useLottieAssets(isAdmin);
  const updateSettings = useUpdateAdminSettings();
  const uploadLottie = useUploadLottieAsset();
  const [lottieLabel, setLottieLabel] = useState("");
  const [lottieCategory, setLottieCategory] = useState<VideoCategory>("business");
  const [lottieTags, setLottieTags] = useState("");
  const [lottieFileName, setLottieFileName] = useState("");
  const [lottieJson, setLottieJson] = useState<Record<string, unknown> | null>(null);

  if (!meLoading && !isAdmin) return <Navigate to="/dashboard" replace />;

  if (meLoading || isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  const apiUsage = data.apiUsage;
  const usagePercent = Math.min(100, Math.max(0, apiUsage.percentOfLimit));
  const usageBarWidth = usagePercent === 0 ? "0%" : `${Math.max(2, usagePercent)}%`;
  const usageBadgeVariant =
    usagePercent >= 90 ? "danger" : usagePercent >= 75 ? "warning" : "accent";
  const userKeysEnabled = data.settings.allowUserApiKeys;

  const toggleUserApiKeys = async () => {
    const nextValue = !userKeysEnabled;

    try {
      await updateSettings.mutateAsync({ allowUserApiKeys: nextValue });
      toast.success(`User API keys ${nextValue ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setting update failed");
    }
  };

  const handleLottieFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    setLottieFileName(file.name);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      if (!isJsonObject(parsed) || !Array.isArray(parsed.layers)) {
        throw new Error("Upload a Lottie JSON export with a layers array.");
      }

      setLottieJson(parsed);
      if (!lottieLabel.trim()) {
        setLottieLabel(file.name.replace(/\.(json|lottie)$/i, "").replace(/[-_]+/g, " "));
      }
      toast.success("Lottie JSON ready");
    } catch (err) {
      setLottieJson(null);
      toast.error(err instanceof Error ? err.message : "Could not read that Lottie file");
    }
  };

  const handleUploadLottie = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const label = lottieLabel.trim();
    if (!label) {
      toast.error("Add a name for this animation");
      return;
    }

    if (!lottieJson) {
      toast.error("Choose a Lottie JSON file first");
      return;
    }

    const tags = lottieTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      await uploadLottie.mutateAsync({
        label,
        category: lottieCategory,
        tags,
        animationData: lottieJson,
      });
      toast.success("Lottie animation added");
      setLottieLabel("");
      setLottieTags("");
      setLottieFileName("");
      setLottieJson(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lottie upload failed");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="mt-2 text-sm text-muted">System overview and recent activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map(({ key, label, icon: Icon }) => (
          <section key={key} className="rounded-lg border border-border bg-surface p-5">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent-soft">
              <Icon size={17} />
            </div>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold">{data.stats[key]}</p>
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent-soft">
              <KeyRound size={17} />
            </div>
            <h2 className="text-lg font-semibold">User API keys</h2>
            <p className="mt-1 text-sm text-muted">
              {userKeysEnabled ? "Profile keys enabled" : "Server keys only"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={userKeysEnabled}
            aria-label="Toggle user API keys"
            disabled={updateSettings.isPending}
            onClick={toggleUserApiKeys}
            className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-surface-2 p-0.5 transition-colors aria-checked:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={`block h-5 w-5 rounded-full bg-fg shadow transition-transform ${
                userKeysEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent-soft">
              <KeyRound size={17} />
            </div>
            <h2 className="text-lg font-semibold">API key usage</h2>
            <p className="mt-1 text-sm text-muted">
              {formatUsagePeriod(apiUsage.periodStart, apiUsage.periodEnd)}
            </p>
          </div>
          <Badge variant={usageBadgeVariant} className="w-fit">
            <Gauge size={13} />
            {usagePercent}% used
          </Badge>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">{formatNumber(apiUsage.totalTokens)} tokens</span>
            <span className="text-muted">
              {formatNumber(apiUsage.monthlyTokenLimit)} monthly limit
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-soft to-success transition-all"
              style={{ width: usageBarWidth }}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-sm text-muted">Requests</p>
            <p className="text-xl font-bold">{formatNumber(apiUsage.totalRequests)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Input tokens</p>
            <p className="text-xl font-bold">{formatNumber(apiUsage.inputTokens)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Output tokens</p>
            <p className="text-xl font-bold">{formatNumber(apiUsage.outputTokens)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Last used</p>
            <p className="text-xl font-bold">
              {apiUsage.lastUsedAt ? formatRelativeTime(apiUsage.lastUsedAt) : "Never"}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {apiUsage.byProvider.length ? (
            apiUsage.byProvider.map((provider) => {
              const providerPercent = apiUsage.totalTokens
                ? Math.round((provider.totalTokens / apiUsage.totalTokens) * 100)
                : 0;
              const providerWidth =
                providerPercent === 0 ? "0%" : `${Math.max(2, providerPercent)}%`;

              return (
                <div key={`${provider.provider}-${provider.keySource}`}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium">
                      {formatProvider(provider.provider)} /{" "}
                      <span className="text-muted">{formatKeySource(provider.keySource)}</span>
                    </span>
                    <span className="text-muted">
                      {formatNumber(provider.totalTokens)} tokens /{" "}
                      {formatNumber(provider.requests)} requests
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent-soft"
                      style={{ width: providerWidth }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
              No tracked API calls this month.
            </p>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-semibold">Recent users</h2>
          <div className="space-y-3">
            {data.recentUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.name ?? "User"}</p>
                  <p className="truncate text-xs text-muted">{user.email}</p>
                </div>
                <p className="shrink-0 text-xs text-muted">{user.credits} credits</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-semibold">Recent projects</h2>
          <div className="space-y-3">
            {data.recentProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{project.prompt}</p>
                  <p className="text-xs text-muted">
                    {project.status} - {formatRelativeTime(project.createdAt)}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted">{project.progress}%</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-4 text-lg font-semibold">Credits</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted">Issued</p>
            <p className="text-xl font-bold">{data.stats.creditsIssued}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Spent</p>
            <p className="text-xl font-bold">{data.stats.creditsSpent}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Running</p>
            <p className="text-xl font-bold">{data.stats.runningProjects}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
