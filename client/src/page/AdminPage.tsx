import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Film,
  Gauge,
  KeyRound,
  RefreshCw,
  Users,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  useAdminOverview,
  useMe,
  useUpdateAdminSettings,
} from "@/lib/queries";
import ProvidersManager from "./ProvidersManager";
import ProjectsManager from "./ProjectsManager";
import UsersManager from "./UsersManager";
import { cn, formatRelativeTime } from "@/lib/utils";

const statCards = [
  { key: "users", label: "Users", icon: Users },
  { key: "projects", label: "Projects", icon: Activity },
  { key: "doneProjects", label: "Done", icon: CheckCircle2 },
  { key: "failedProjects", label: "Failed", icon: AlertTriangle },
] as const;

type AdminTab = "overview" | "projects" | "providers" | "users";
const TABS: { id: AdminTab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "projects", label: "Projects", icon: Film },
  { id: "providers", label: "Providers", icon: KeyRound },
  { id: "users", label: "Users", icon: Users },
];

const numberFormat = new Intl.NumberFormat("en");

function formatNumber(value: number) {
  return numberFormat.format(value || 0);
}

function formatProvider(provider: string) {
  return provider === "openai" ? "OpenAI" : provider === "openrouter" ? "OpenRouter" : "Gemini";
}

function formatKeySource(source: string) {
  return source === "user" ? "User key" : "Server key";
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
  const { data, isLoading, refetch, isFetching } = useAdminOverview(isAdmin);
  const updateSettings = useUpdateAdminSettings();
  const [tab, setTab] = useState<AdminTab>("overview");

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

  return (
    <div className="mx-auto w-full max-w-[1500px] px-8 py-[26px]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="mt-1.5 text-sm text-muted">System overview and configuration.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-surface px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-accent/40 hover:text-fg"
        >
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ---- Section switcher — each button swaps the panel below. ---- */}
      <div className="mb-[22px] inline-flex flex-wrap gap-1.5 rounded-xl border border-white/[0.07] bg-surface p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "bg-accent text-accent-ink shadow-accent"
                : "text-muted hover:bg-surface-2 hover:text-fg"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ================= OVERVIEW ================= */}
      {tab === "overview" && (
        <div className="space-y-[18px]">
          <div className="grid grid-cols-2 gap-[18px] xl:grid-cols-4">
            {statCards.map(({ key, label, icon: Icon }) => (
              <section key={key} className="rounded-[14px] border border-white/[0.07] bg-surface p-[18px]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent-soft">
                  <Icon size={17} />
                </div>
                <p className="text-sm text-muted">{label}</p>
                <p
                  className={`mt-1 text-[26px] font-bold leading-none ${
                    key === "failedProjects" && data.stats[key] > 0 ? "text-red-400" : ""
                  }`}
                >
                  {data.stats[key]}
                </p>
              </section>
            ))}
          </div>

          {/* API key usage */}
          <section className="rounded-[14px] border border-white/[0.07] bg-surface p-[18px]">
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

          {/* Recent users / projects */}
          <div className="grid gap-[18px] sm:grid-cols-2">
            <section className="rounded-[14px] border border-white/[0.07] bg-surface p-[18px]">
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

            <section className="rounded-[14px] border border-white/[0.07] bg-surface p-[18px]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Recent projects</h2>
                <button
                  type="button"
                  onClick={() => setTab("projects")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                >
                  <Film size={13} /> View all
                </button>
              </div>
              <div className="space-y-3">
                {data.recentProjects.map((project) => {
                  const failed = project.status === "FAILED" || project.progress === 0;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setTab("projects")}
                      className="flex w-full items-center justify-between gap-4 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-surface-2/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{project.prompt}</p>
                        <p className="truncate text-xs text-muted">
                          {project.status} · {formatRelativeTime(project.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          failed
                            ? "bg-red-500/15 text-red-400"
                            : "bg-accent/15 text-accent-soft"
                        }`}
                      >
                        {project.progress}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Credits */}
          <section className="rounded-[14px] border border-white/[0.07] bg-surface p-[18px]">
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
      )}

      {/* ================= PROJECTS ================= */}
      {tab === "projects" && <ProjectsManager />}

      {/* ================= PROVIDERS ================= */}
      {tab === "providers" && (
        <div className="space-y-[18px]">
          <section className="rounded-[14px] border border-white/[0.07] bg-surface p-[18px]">
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

          <ProvidersManager isAdmin={isAdmin} />
        </div>
      )}

      {/* ================= USERS ================= */}
      {tab === "users" && <UsersManager />}
    </div>
  );
}
