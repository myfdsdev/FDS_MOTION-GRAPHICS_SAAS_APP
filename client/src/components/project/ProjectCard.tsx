import { Link } from "react-router-dom";
import { Play, Clock } from "lucide-react";
import type { Project } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { formatRelativeTime } from "@/lib/utils";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="group block rounded-xl border border-border bg-surface overflow-hidden hover:border-neutral-700 transition-colors"
    >
      {/* Thumbnail */}
      <div
        className="aspect-video bg-gradient-to-br from-surface-3 to-surface-2 relative overflow-hidden"
        style={{
          backgroundImage: project.thumbnailUrl
            ? `url(${project.thumbnailUrl})`
            : `linear-gradient(135deg, #1f1f1f 0%, #2a1f3d 100%)`,
          backgroundSize: "cover",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {project.status === "DONE" ? (
            <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play size={20} fill="white" className="text-white ml-0.5" />
            </div>
          ) : (
            <div className="text-xs text-muted bg-black/40 backdrop-blur px-3 py-1.5 rounded-full">
              {project.status === "FAILED" ? "Render failed" : `${project.progress}%`}
            </div>
          )}
        </div>
        <div className="absolute top-2 right-2">
          <StatusBadge status={project.status} />
        </div>
        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-white/80 bg-black/40 backdrop-blur px-2 py-1 rounded">
          <Clock size={10} />
          {project.durationSec}s
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="text-sm font-medium text-white line-clamp-2 leading-snug mb-2">
          {project.prompt}
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{project.template?.replace(/-/g, " ") ?? "—"}</span>
          <span>{formatRelativeTime(project.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
