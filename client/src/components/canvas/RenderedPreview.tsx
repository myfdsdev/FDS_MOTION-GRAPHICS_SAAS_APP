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
