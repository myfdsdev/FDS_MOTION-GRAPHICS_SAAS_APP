import { Activity, AlertTriangle, CheckCircle2, Gauge, KeyRound, Users } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useAdminOverview, useMe } from "@/lib/queries";
import { formatRelativeTime } from "@/lib/utils";

const statCards = [
  { key: "users", label: "Users", icon: Users },
  { key: "projects", label: "Projects", icon: Activity },
  { key: "doneProjects", label: "Done", icon: CheckCircle2 },
  { key: "failedProjects", label: "Failed", icon: AlertTriangle },
] as const;

const numberFormat = new Intl.NumberFormat("en");

function formatNumber(value: number) {
  return numberFormat.format(value || 0);
}

function formatProvider(provider: string) {
  return provider === "openai" ? "OpenAI" : "Gemini";
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
  const { data, isLoading } = useAdminOverview(isAdmin);

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
