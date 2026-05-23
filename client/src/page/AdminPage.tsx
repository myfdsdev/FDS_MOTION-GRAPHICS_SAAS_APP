import { Activity, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAdminOverview, useMe } from "@/lib/queries";
import { formatRelativeTime } from "@/lib/utils";

const statCards = [
  { key: "users", label: "Users", icon: Users },
  { key: "projects", label: "Projects", icon: Activity },
  { key: "doneProjects", label: "Done", icon: CheckCircle2 },
  { key: "failedProjects", label: "Failed", icon: AlertTriangle },
] as const;

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
