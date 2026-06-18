import { useState } from "react";
import { AlertTriangle, Copy, RotateCcw, X } from "lucide-react";
import type { Project } from "@/types";
import { Tooltip } from "@/components/ui/Tooltip";

const PHASE_LABEL: Record<NonNullable<Project["errorPhase"]>, string> = {
  "load-plan": "Loading the scene plan",
  "plan-scenes": "Planning hybrid scenes",
  "generate-footage": "Generating footage clips",
  "attach-lottie": "Attaching Lottie assets",
  bundle: "Bundling the Remotion composition",
  "select-composition": "Selecting the composition",
  preflight: "Testing preview frames",
  render: "Rendering frames",
  upload: "Uploading the MP4",
  finalize: "Finalizing the project",
  tts: "Generating narration",
  ai: "Writing the narration",
};

interface Props {
  project: Project;
  onRetry?: () => void;
}

/**
 * Compact "Why did this fail?" card. Shows the structured error fields the
 * worker captured (phase, code, message), the warnings collected during the
 * project's life, and a click-to-copy stack trace for support / debugging.
 *
 * Only renders when there's actually something to show — so it's safe to
 * mount unconditionally next to the Render button.
 */
export function RenderErrorDetails({ project, onRetry }: Props) {
  const [open, setOpen] = useState(false);
  const hasError = project.status === "FAILED" || !!project.errorMessage;
  const hasWarnings = (project.warnings?.length ?? 0) > 0;
  if (!hasError && !hasWarnings) return null;

  const phaseLabel = project.errorPhase ? PHASE_LABEL[project.errorPhase] : null;

  const copy = async () => {
    const blob = [
      `Project: ${project.id}`,
      `Status: ${project.status}`,
      project.errorPhase ? `Phase: ${project.errorPhase} (${phaseLabel})` : null,
      project.errorCode ? `Code: ${project.errorCode}` : null,
      project.errorAt ? `When: ${project.errorAt}` : null,
      project.errorMessage ? `Message: ${project.errorMessage}` : null,
      project.renderAttempts != null ? `Attempts: ${project.renderAttempts}` : null,
      project.warnings?.length
        ? "Warnings:\n" +
          project.warnings
            .map((w) => `  · [${w.phase ?? "?"}] ${w.message}`)
            .join("\n")
        : null,
      project.errorStack ? `\nStack:\n${project.errorStack}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(blob);
    } catch {
      /* clipboard blocked — silently no-op */
    }
  };

  return (
    <>
      <Tooltip content={hasError ? "View error details" : "View warnings"} side="bottom">
        <button
          onClick={() => setOpen(true)}
          className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-medium ${
            hasError
              ? "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15"
              : "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15"
          }`}
        >
          <AlertTriangle size={13} />
          <span className="hidden sm:inline">
            {hasError ? "Error" : `${project.warnings?.length} warning${project.warnings?.length === 1 ? "" : "s"}`}
          </span>
        </button>
      </Tooltip>

      {open && (
        // Click outside to close. The flex container guarantees the modal
        // can't grow taller than the viewport — header/footer pin, body scrolls.
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-3 backdrop-blur-sm sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border-soft px-5 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  size={16}
                  className={hasError ? "text-danger" : "text-warning"}
                />
                <span className="text-sm font-semibold">
                  {hasError ? "Render failed" : "Render warnings"}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
              {hasError && (
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
                    Root cause
                  </h4>
                  <dl className="space-y-1 rounded-lg border border-border bg-surface-2/40 p-3 text-xs">
                    {phaseLabel && (
                      <Row label="Phase" value={`${project.errorPhase} — ${phaseLabel}`} />
                    )}
                    {project.errorCode && <Row label="Code" value={project.errorCode} mono />}
                    {project.errorMessage && (
                      <Row label="Message" value={project.errorMessage} wrap />
                    )}
                    {project.errorAt && (
                      <Row label="When" value={new Date(project.errorAt).toLocaleString()} />
                    )}
                    {project.renderAttempts != null && (
                      <Row label="Attempts" value={String(project.renderAttempts)} />
                    )}
                  </dl>
                </section>
              )}

              {hasWarnings && (
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
                    Warnings ({project.warnings!.length})
                  </h4>
                  <ul className="space-y-1.5 text-xs">
                    {project.warnings!.map((w, i) => (
                      <li
                        key={i}
                        className="rounded border border-border bg-surface-2/40 p-2"
                      >
                        <div className="flex items-center justify-between text-[10px] text-faint">
                          <span className="font-mono uppercase">{w.phase ?? "?"}</span>
                          {w.at && (
                            <span>{new Date(w.at).toLocaleTimeString()}</span>
                          )}
                        </div>
                        <div className="mt-0.5">{w.message}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {project.errorStack && (
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
                    Stack trace
                  </h4>
                  <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-surface-2/60 p-3 font-mono text-[10px] leading-snug text-muted">
                    {project.errorStack}
                  </pre>
                </section>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border-soft bg-bg/60 px-5 py-3">
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg hover:border-accent/40"
              >
                <Copy size={13} /> Copy report
              </button>
              {hasError && onRetry && (
                <button
                  onClick={() => {
                    onRetry();
                    setOpen(false);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
                >
                  <RotateCcw size={13} /> Retry render
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({
  label,
  value,
  mono,
  wrap,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <dt className="text-faint">{label}</dt>
      <dd
        className={`text-fg ${mono ? "font-mono" : ""} ${
          wrap ? "break-words" : "truncate"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
