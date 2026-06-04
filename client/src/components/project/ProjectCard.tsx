import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Clock } from "lucide-react";
import type { Project } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { formatRelativeTime } from "@/lib/utils";

const MotionLink = motion(Link);

export function ProjectCard({ project }: { project: Project }) {
  return (
    <MotionLink
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4 }}
      to={`/projects/${project.id}/edit`}
      className="group block rounded-xl border border-border bg-surface overflow-hidden hover:border-accent/40 transition-colors"
    >
      {/* Thumbnail */}
      <div
        className="aspect-video bg-gradient-to-br from-surface-3 to-surface-2 relative overflow-hidden"
        style={{
          backgroundImage: project.thumbnailUrl
            ? `url(${project.thumbnailUrl})`
            : `linear-gradient(135deg, oklch(0.30 0.08 290) 0%, oklch(0.15 0.06 290) 100%)`,
          backgroundSize: "cover",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {project.status === "DONE" ? (
            <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play size={20} fill="white" className="text-fg ml-0.5" />
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
        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-fg/80 bg-black/40 backdrop-blur px-2 py-1 rounded">
          <Clock size={10} />
          {project.durationSec}s
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="text-sm font-medium text-fg line-clamp-2 leading-snug mb-2">
          {project.prompt}
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{project.template?.replace(/-/g, " ") ?? "—"}</span>
          <span>{formatRelativeTime(project.createdAt)}</span>
        </div>
      </div>
    </MotionLink>
  );
}
