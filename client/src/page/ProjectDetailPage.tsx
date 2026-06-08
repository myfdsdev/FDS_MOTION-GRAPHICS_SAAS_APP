import { useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Download,
  RotateCcw,
  Share2,
  Trash2,
  ArrowLeft,
  Play,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { useProject, useDeleteProject, useRerender } from "@/lib/queries";
import { StatusBadge } from "@/components/project/StatusBadge";
import { ProgressRing } from "@/components/project/ProgressRing";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id);
  const del = useDeleteProject();
  const rerender = useRerender();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 animate-pulse">
        <div className="h-8 w-1/3 bg-surface-2 rounded mb-4" />
        <div className="aspect-video bg-surface-2 rounded-xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold mb-2">Project not found</h1>
        <Button asChild variant="secondary">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const isDone = project.status === "DONE";
  const isFailed = project.status === "FAILED";
  const isInProgress = !isDone && !isFailed;

  const handleDelete = async () => {
    if (!confirm("Delete this project? This can't be undone.")) return;
    await del.mutateAsync(project.id);
    toast.success("Project deleted");
    navigate("/dashboard");
  };

  const handleRerender = async () => {
    await rerender.mutateAsync(project.id);
    toast.success("Re-render queued");
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        All projects
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status={project.status} />
            <span className="text-xs text-faint">
              {formatDateTime(project.createdAt)}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold leading-snug">
            {project.prompt}
          </h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button asChild variant="secondary" size="sm">
            <Link to={`/projects/${project.id}/edit`}>
              <Pencil size={14} />
              Edit
            </Link>
          </Button>
          {isDone && (
            <>
              <Button variant="secondary" size="sm" onClick={handleShare}>
                <Share2 size={14} />
                Share
              </Button>
              <Button asChild size="sm">
                <Link to={`/projects/${project.id}/download`}>
                  <Download size={14} />
                  Download
                </Link>
              </Button>
            </>
          )}
          {isFailed && (
            <Button size="sm" onClick={handleRerender} disabled={rerender.isPending}>
              <RotateCcw size={14} />
              Retry
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Main preview */}
      <div
        className="aspect-video w-full rounded-xl border border-border bg-surface overflow-hidden mb-8 relative"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #0f0f0f 0%, #1a0f2e 50%, #2a1f3d 100%)",
        }}
      >
        {isDone && project.outputUrl ? (
          <video
            ref={videoRef}
            src={project.outputUrl}
            controls
            playsInline
            className="absolute inset-0 w-full h-full object-contain bg-black"
          />
        ) : isDone ? (
          <div className="absolute inset-0 flex items-center justify-center group cursor-pointer">
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center group-hover:bg-white/15 transition-all">
              <Play size={28} fill="white" className="text-fg ml-1" />
            </div>
          </div>
        ) : isFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-danger/20 flex items-center justify-center mb-3">
              <AlertCircle size={20} className="text-danger" />
            </div>
            <p className="font-semibold mb-1">Render failed</p>
            <p className="text-sm text-muted max-w-md">
              {project.errorMessage ?? "Something went wrong while rendering."}
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <ProgressRing progress={project.progress} />
            <p className="mt-4 text-sm text-muted">
              {project.status === "PLANNING" && "Designing your video plan…"}
              {project.status === "GENERATING_ASSETS" && "Generating visuals…"}
              {project.status === "QUEUED" && "Waiting for a render slot…"}
              {project.status === "RENDERING" && "Rendering frames…"}
            </p>
          </div>
        )}
      </div>

      {/* Scene plan */}
      {project.sceneJson && (
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wider">
            Scene plan
          </h2>
          <div className="space-y-3">
            {project.sceneJson.scenes.map((s, i) => (
              <div
                key={s.scene}
                onClick={() => setSelectedScene(i)}
                className={`bg-surface border rounded-lg p-4 flex items-start gap-4 cursor-pointer transition ${
                  selectedScene === i ? "border-accent" : "border-border hover:border-accent/40"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center font-bold text-accent-soft shrink-0">
                  {s.scene}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium mb-1">{s.text}</div>
                  <div className="text-xs text-muted mb-2">{s.visual}</div>
                  <div className="flex gap-2 flex-wrap text-xs">
                    <span className="px-2 py-0.5 bg-surface-2 rounded border border-border">
                      {s.duration}s
                    </span>
                    <span className="px-2 py-0.5 bg-surface-2 rounded border border-border">
                      {s.animation}
                    </span>
                    <span className="px-2 py-0.5 bg-surface-2 rounded border border-border">
                      → {s.transition}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="mt-8 pt-6 border-t border-border-soft grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <Meta label="Aspect ratio" value={project.aspectRatio} />
        <Meta label="Duration" value={`${project.durationSec}s`} />
        <Meta label="Scenes" value={String(project.sceneJson?.scenes.length ?? 0)} />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted mb-0.5">{label}</div>
      <div className="font-medium capitalize">{value}</div>
    </div>
  );
}
