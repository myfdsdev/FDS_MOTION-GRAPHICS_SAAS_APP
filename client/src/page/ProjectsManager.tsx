import { useState } from "react";
import { Download, Film, Loader2, Search, X } from "lucide-react";
import { StatusBadge } from "@/components/project/StatusBadge";
import { useAdminProjects } from "@/lib/queries";
import { formatRelativeTime } from "@/lib/utils";
import type { AdminProject, ProjectStatus } from "@/types";

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "DONE", label: "Done" },
  { id: "RENDERING", label: "Rendering" },
  { id: "QUEUED", label: "Queued" },
  { id: "FAILED", label: "Failed" },
];

export default function ProjectsManager() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<AdminProject | null>(null);
  const { data: projects = [], isLoading } = useAdminProjects({ search, status });

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">All projects</h2>
          <p className="text-xs text-muted">Browse and open any user's video.</p>
        </div>
        <span className="text-xs text-muted">{projects.length} shown</span>
      </div>

      {/* Search + status filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompt or owner email…"
            className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent/50"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                status === f.id
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-border bg-surface-2 text-muted hover:border-accent/40 hover:text-fg"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted">
          <Loader2 size={15} className="animate-spin" /> Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted">No projects match.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="py-2 pr-3 font-medium">Project</th>
                <th className="py-2 px-3 font-medium">Owner</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Created</th>
                <th className="py-2 pl-3 text-right font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="cursor-pointer border-b border-border-soft/60 transition-colors hover:bg-surface-2/60"
                >
                  <td className="max-w-[280px] py-2.5 pr-3">
                    <div className="truncate font-medium text-fg">{p.prompt || "Untitled"}</div>
                    <div className="text-xs text-muted">
                      {p.aspectRatio} · {p.durationSec}s
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="truncate text-xs text-fg">{p.owner?.name || "—"}</div>
                    <div className="truncate text-xs text-muted">{p.owner?.email ?? "unknown"}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={p.status as ProjectStatus} />
                  </td>
                  <td className="py-2.5 px-3 text-xs text-muted">{formatRelativeTime(p.createdAt)}</td>
                  <td className="py-2.5 pl-3 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                      <Film size={13} /> View
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <ProjectViewer project={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ProjectViewer({ project, onClose }: { project: AdminProject; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border-soft px-5 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusBadge status={project.status as ProjectStatus} />
              <span className="text-xs text-muted">{project.owner?.email ?? "unknown owner"}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm font-medium text-fg">{project.prompt}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-fg"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* Video / preview */}
          <div className="overflow-hidden rounded-xl border border-border bg-black">
            {project.outputUrl && project.status === "DONE" ? (
              <video
                src={project.outputUrl}
                controls
                playsInline
                className="aspect-video w-full bg-black object-contain"
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-muted">
                <Film size={26} className="text-faint" />
                <span className="text-sm">
                  {project.status === "FAILED"
                    ? "This render failed — no video to show."
                    : project.status === "DONE"
                      ? "No output file on record."
                      : "Still generating — no preview yet."}
                </span>
              </div>
            )}
          </div>

          {/* Meta grid */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Meta label="Owner" value={project.owner?.name || project.owner?.email || "—"} />
            <Meta label="Format" value={project.aspectRatio} />
            <Meta label="Length" value={`${project.durationSec}s`} />
            <Meta label="Progress" value={`${project.progress}%`} />
            <Meta label="Recipe" value={project.recipe || "auto"} />
            <Meta label="Created" value={formatRelativeTime(project.createdAt)} />
            <Meta label="Updated" value={formatRelativeTime(project.updatedAt)} />
            <Meta label="Attempts" value={String(project.renderAttempts ?? 0)} />
          </div>

          {/* Error, if any */}
          {project.status === "FAILED" && project.errorMessage && (
            <div className="mt-4 rounded-xl border border-danger/40 bg-danger/5 p-3">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-danger">
                Failure{project.errorPhase ? ` · ${project.errorPhase}` : ""}
              </div>
              <p className="text-xs leading-relaxed text-fg">{project.errorMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {project.outputUrl && project.status === "DONE" && (
          <div className="flex items-center justify-end gap-2 border-t border-border-soft px-5 py-3">
            <a
              href={project.outputUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
            >
              <Download size={13} /> Download MP4
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium capitalize text-fg" title={value}>
        {value}
      </p>
    </div>
  );
}
