import { useEffect, useRef } from "react";
import { AlertTriangle, Copy, Film, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/types";

const PHASE_LABEL: Record<NonNullable<Project["errorPhase"]>, string> = {
  "load-plan": "Loading the scene plan",
  "attach-lottie": "Attaching Lottie assets",
  bundle: "Bundling the Remotion composition",
  "select-composition": "Selecting the composition",
  render: "Rendering frames",
  upload: "Uploading the MP4",
  finalize: "Finalizing the project",
  tts: "Generating narration",
  ai: "AI scene plan generation",
  codegen: "AI Remotion code generation",
  "bundle-codegen": "Bundling generated Remotion code",
};

interface RenderedPreviewProps {
  project: Project;
  /** Editor-driven playhead in seconds. The video element is seeked to match. */
  currentTime: number;
  playing: boolean;
  /** Called whenever the <video> advances on its own (during play) so the
   *  editor's timeline ruler can follow it. */
  onTimeUpdate?: (t: number) => void;
  /** Optional one-click retry — wired to the editor's `handleRender`. */
  onRetry?: () => void;
}

/**
 * Renders the project's already-baked MP4 as the preview surface. Way faster
 * than running the Remotion Player live and guaranteed 1:1 with whatever the
 * worker produced — what you see IS what you'll download.
 *
 * Shows a placeholder when the project hasn't been rendered yet (or is
 * currently rendering); the placeholder explains what to do next so the
 * editor never feels broken.
 */
export function RenderedPreview({
  project,
  currentTime,
  playing,
  onTimeUpdate,
  onRetry,
}: RenderedPreviewProps) {
  const ref = useRef<HTMLVideoElement>(null);

  // Mirror the editor playhead onto the video element. Skip while playing so
  // the video runs its own clock smoothly — only correct when the user scrubs.
  useEffect(() => {
    const v = ref.current;
    if (!v || playing) return;
    if (Math.abs(v.currentTime - currentTime) > 0.05) {
      v.currentTime = currentTime;
    }
  }, [currentTime, playing]);

  // Sync play / pause with the editor.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing]);

  const status = project.status;
  const hasMp4 = !!project.outputUrl && status === "DONE";

  if (hasMp4) {
    return (
      <video
        ref={ref}
        src={project.outputUrl}
        className="absolute inset-0 h-full w-full bg-black object-contain"
        playsInline
        // Editor owns transport — don't expose native controls.
        controls={false}
        muted={false}
        onTimeUpdate={(e) => {
          if (playing) onTimeUpdate?.(e.currentTarget.currentTime);
        }}
      />
    );
  }

  // ---- Placeholder states ----
  const rendering = status === "RENDERING" || status === "QUEUED";
  const generating = status === "PLANNING" || status === "GENERATING_ASSETS";
  const failed = status === "FAILED";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0a0f] text-center text-muted">
      {rendering ? (
        <>
          <Loader2 size={28} className="animate-spin text-accent" />
          <div className="text-sm">
            Rendering preview… {project.progress ? `${project.progress}%` : ""}
          </div>
          <div className="max-w-xs text-xs text-faint">
            Your video is being baked. The preview will appear here when it's ready.
          </div>
        </>
      ) : generating ? (
        <>
          <Loader2 size={28} className="animate-spin text-accent" />
          <div className="text-sm">Generating your scenes…</div>
        </>
      ) : failed ? (
        <RenderFailedCard project={project} onRetry={onRetry} />
      ) : (
        <>
          <Film size={28} className="text-accent" />
          <div className="text-sm">No preview yet</div>
          <div className="max-w-xs text-xs text-faint">
            Click <span className="font-semibold text-fg">Render</span> in the
            top-right to bake your first preview. Future renders update this
            view instantly.
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Big, can't-miss error card shown ON the preview surface when a render
 * fails. Shows the root cause (phase + code + message) directly so the user
 * doesn't have to chase a tiny ⚠ icon in the header to find out what went
 * wrong. Includes one-click Retry and Copy Report.
 */
function RenderFailedCard({
  project,
  onRetry,
}: {
  project: Project;
  onRetry?: () => void;
}) {
  const phaseLabel = project.errorPhase ? PHASE_LABEL[project.errorPhase] : null;
  const warnings = project.warnings ?? [];

  const copy = async () => {
    const blob = [
      `Project: ${project.id}`,
      project.errorPhase ? `Phase: ${project.errorPhase} (${phaseLabel})` : null,
      project.errorCode ? `Code: ${project.errorCode}` : null,
      project.errorAt ? `When: ${project.errorAt}` : null,
      project.errorMessage ? `Message: ${project.errorMessage}` : null,
      project.renderAttempts != null ? `Attempts: ${project.renderAttempts}` : null,
      warnings.length
        ? "Warnings:\n" + warnings.map((w) => `  · [${w.phase ?? "?"}] ${w.message}`).join("\n")
        : null,
      project.errorStack ? `\nStack:\n${project.errorStack}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(blob);
      toast.success("Error report copied");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <div className="m-auto flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-danger/40 bg-danger/5 text-left shadow-2xl">
      <div className="flex shrink-0 items-center gap-2 border-b border-danger/30 bg-danger/10 px-5 py-3">
        <AlertTriangle size={16} className="text-danger" />
        <span className="text-sm font-semibold text-danger">Render failed</span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
        {phaseLabel && (
          <Row label="Where it broke" value={`${phaseLabel}`} />
        )}
        {project.errorCode && (
          <Row label="Code" value={project.errorCode} mono />
        )}
        {project.errorMessage && (
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-faint">Why</div>
            <div className="rounded-lg border border-border bg-bg/60 p-3 text-xs leading-relaxed text-fg">
              {project.errorMessage}
            </div>
          </div>
        )}
        {project.renderAttempts != null && project.renderAttempts > 0 && (
          <Row label="Attempts so far" value={String(project.renderAttempts)} />
        )}
        {warnings.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-faint">
              Warnings ({warnings.length})
            </div>
            <ul className="space-y-1">
              {warnings.slice(-5).map((w, i) => (
                <li
                  key={i}
                  className="rounded border border-warning/30 bg-warning/5 p-2 text-[11px] text-warning"
                >
                  <span className="font-mono uppercase opacity-70">{w.phase ?? "?"}</span>{" "}
                  {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-danger/30 bg-bg/40 px-5 py-3">
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg hover:border-accent/40"
        >
          <Copy size={13} /> Copy report
        </button>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
          >
            <RotateCcw size={13} /> Retry render
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-xs">
      <div className="text-faint">{label}</div>
      <div className={`text-fg ${mono ? "font-mono" : ""} break-words`}>{value}</div>
    </div>
  );
}
