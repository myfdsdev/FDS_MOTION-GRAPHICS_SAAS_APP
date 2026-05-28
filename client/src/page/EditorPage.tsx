import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  CopyPlus,
  History,
  Layers,
  Library,
  Magnet,
  Maximize,
  MessageSquare,
  Monitor,
  MousePointer2,
  Music,
  Palette,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useMe, useProject, useUpdateProject } from "@/lib/queries";
import { Timeline } from "@/components/project/Timeline";
import { Tooltip } from "@/components/ui/Tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEditorShortcuts } from "@/lib/editor/useEditorShortcuts";
import {
  canRedo,
  canUndo,
  createInitialState,
  editorReducer,
  toTimeline,
  totalDuration,
} from "@/lib/editor/editorStore";
import { DEFAULT_PX_PER_SECOND, FPS } from "@/lib/editor/editorTypes";
import { cn } from "@/lib/utils";
import type { Scene, VideoPlan } from "@/types";

type PanelId = "chat" | "edit" | "media" | "fonts" | "colors" | "projects" | "templates";

const RAIL: { id: PanelId; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "edit", label: "Edit", icon: SlidersHorizontal },
  { id: "media", label: "Media", icon: Library },
  { id: "fonts", label: "Fonts", icon: Type },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "projects", label: "Projects", icon: Library },
  { id: "templates", label: "Templates", icon: Sparkles },
];

const EMPTY_STATE = createInitialState([]);

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: project, isLoading } = useProject(id);
  const updateProject = useUpdateProject(id);

  const [state, dispatch] = useReducer(editorReducer, EMPTY_STATE);
  const [panel, setPanel] = useState<PanelId>("chat");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  const hasVideo = project?.status === "DONE" && Boolean(project.outputUrl);
  const editable = project ? project.status !== "QUEUED" && project.status !== "RENDERING" : false;
  const total = totalDuration(state);

  // Initialize the store once the project loads.
  useEffect(() => {
    if (project && !initRef.current) {
      initRef.current = true;
      dispatch({
        type: "RESET",
        state: createInitialState(
          project.sceneJson?.scenes ?? [],
          project.sceneJson?.timeline ?? null
        ),
      });
    }
  }, [project]);

  // Debounced autosave of the timeline.
  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    if (!initRef.current || !project?.sceneJson || !editable) return;
    const timeline = toTimeline(state, FPS);
    const serialized = JSON.stringify({ tracks: timeline.tracks, zoom: timeline.zoomRegions });
    if (serialized === lastSavedRef.current) return;
    const handle = setTimeout(() => {
      lastSavedRef.current = serialized;
      const sceneJson: VideoPlan = {
        ...project.sceneJson!,
        duration: Math.max(1, Math.round(timeline.duration)),
        timeline,
      };
      updateProject.mutate({ sceneJson });
    }, 900);
    return () => clearTimeout(handle);
  }, [state.tracks, state.zoomRegions, editable, project, updateProject]);

  // Virtual clock for projects without a rendered video.
  useEffect(() => {
    if (!playing || hasVideo) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setCurrentTime((t) => {
        const next = t + dt;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, hasVideo, total]);

  // Sync with the real <video> when one exists.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [project?.outputUrl]);

  const togglePlay = () => {
    if (hasVideo && videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
      return;
    }
    if (currentTime >= total) setCurrentTime(0);
    setPlaying((p) => !p);
  };

  const handleSeek = (time: number) => {
    const clamped = Math.max(0, Math.min(total, time));
    setCurrentTime(clamped);
    if (hasVideo && videoRef.current) videoRef.current.currentTime = clamped;
  };

  // Toolbar handlers
  const undo = () => dispatch({ type: "UNDO" });
  const redo = () => dispatch({ type: "REDO" });
  const split = () => dispatch({ type: "SPLIT_AT", time: currentTime });
  const duplicate = () => dispatch({ type: "DUPLICATE_SELECTED" });
  const remove = () => dispatch({ type: "DELETE_SELECTED" });
  const addTrack = () => dispatch({ type: "ADD_TRACK", kind: "overlay" });
  const addAudio = () => dispatch({ type: "ADD_TRACK", kind: "audio" });
  const addZoom = () =>
    dispatch({
      type: "ADD_ZOOM",
      start: currentTime,
      end: Math.min(total, currentTime + 2),
    });
  const zoomIn = () =>
    dispatch({ type: "SET_PX_PER_SECOND", value: Math.round(state.pxPerSecond * 1.4) });
  const zoomOut = () =>
    dispatch({ type: "SET_PX_PER_SECOND", value: Math.round(state.pxPerSecond / 1.4) });
  const zoomFit = () => {
    const w = previewRef.current?.parentElement?.clientWidth ?? 900;
    dispatch({ type: "SET_PX_PER_SECOND", value: Math.max(12, Math.floor((w - 140) / total)) });
  };

  useEditorShortcuts({
    undo,
    redo,
    split,
    duplicate,
    remove,
    togglePlay,
    toggleSnap: () => dispatch({ type: "TOGGLE_SNAP" }),
  });

  // Active scene clip under the playhead (for the placeholder preview).
  const activeScene = useMemo<Scene | null>(() => {
    const sceneTrack = state.tracks.find((t) => t.kind === "scene");
    if (!sceneTrack) return null;
    const clip = sceneTrack.clips.find(
      (c) => currentTime >= c.start && currentTime < c.start + c.duration
    );
    return clip?.scene ?? null;
  }, [state.tracks, currentTime]);

  if (!meLoading && !me) return <Navigate to="/login" replace />;

  if (meLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg text-muted">
        Loading editor…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg">
        <p className="text-fg">Project not found</p>
        <Link to="/projects" className="text-sm text-accent hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const brand = project.sceneJson?.brandColors ?? ["#0f172a", "#8b5cf6", "#38bdf8"];
  const hasSelection = state.selection.length > 0;
  const zoomPct = Math.round((state.pxPerSecond / DEFAULT_PX_PER_SECOND) * 100);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-fg">
      {/* ---- Top bar ---- */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-soft bg-bg/80 px-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Tooltip content="Back to project" side="bottom">
            <Link
              to={`/projects/${project.id}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
            >
              <ArrowLeft size={16} />
            </Link>
          </Tooltip>
          <span className="mx-1 h-5 w-px bg-border-soft" />
          <span className="max-w-[36vw] truncate text-sm font-medium">
            {project.prompt || "Untitled Project"}
          </span>
          <Tooltip content="Aspect ratio" side="bottom">
            <button className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs text-muted hover:text-fg">
              <Monitor size={13} /> {project.aspectRatio}
            </button>
          </Tooltip>
          <Tooltip content="Project settings" side="bottom">
            <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
              <Settings size={14} />
            </button>
          </Tooltip>
          {updateProject.isPending && (
            <span className="text-[11px] text-faint">Saving…</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content="Undo" shortcut="⌘Z" side="bottom">
            <IconBtn icon={Undo2} onClick={undo} disabled={!canUndo(state)} />
          </Tooltip>
          <Tooltip content="Redo" shortcut="⌘⇧Z" side="bottom">
            <IconBtn icon={Redo2} onClick={redo} disabled={!canRedo(state)} />
          </Tooltip>
          <Tooltip content="Version history" side="bottom">
            <IconBtn icon={History} />
          </Tooltip>
          <span className="mx-1 h-5 w-px bg-border-soft" />
          <button className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg hover:border-accent/40">
            <Copy size={13} /> Duplicate
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover">
            <Upload size={13} /> Share / Export
          </button>
          <ThemeToggle className="ml-1 h-7 w-7" />
        </div>
      </header>

      {/* ---- Body ---- */}
      <div className="flex min-h-0 flex-1">
        {/* Icon rail */}
        <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-border-soft bg-bg/60 py-3">
          {RAIL.map((item) => {
            const Icon = item.icon;
            const active = panel === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPanel(item.id)}
                className={cn(
                  "flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition",
                  active ? "bg-surface-2 text-accent" : "text-muted hover:bg-surface-2/60 hover:text-fg"
                )}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Left panel */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-border-soft bg-bg/40">
          {panel === "chat" && <ChatPanel credits={me?.credits ?? 0} />}
          {panel === "edit" && <EditPanel state={state} dispatch={dispatch} />}
          {panel !== "chat" && panel !== "edit" && <PlaceholderPanel id={panel} />}
        </aside>

        {/* Preview */}
        <main className="flex min-w-0 flex-1 items-center justify-center bg-[#0a0a0f] p-6">
          <div
            ref={previewRef}
            className={cn(
              "relative w-full max-w-4xl overflow-hidden rounded-lg shadow-2xl",
              project.aspectRatio === "9:16"
                ? "aspect-[9/16] max-h-full max-w-[360px]"
                : project.aspectRatio === "1:1"
                  ? "aspect-square max-h-full max-w-[640px]"
                  : "aspect-video"
            )}
          >
            {hasVideo ? (
              <video
                ref={videoRef}
                src={project.outputUrl}
                playsInline
                className="absolute inset-0 h-full w-full bg-black object-contain"
              />
            ) : (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center"
                style={{
                  background: `radial-gradient(circle at 50% 40%, ${brand[1]}33, transparent 60%), linear-gradient(160deg, ${brand[0]}, #050509)`,
                }}
              >
                {activeScene ? (
                  <>
                    <p className="text-2xl font-bold leading-tight text-white drop-shadow sm:text-4xl">
                      {activeScene.headline || activeScene.text}
                    </p>
                    {activeScene.subtext && (
                      <p className="mt-3 max-w-lg text-sm text-white/70">{activeScene.subtext}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-white/60">
                    No scene under the playhead. Drag the timeline to preview.
                  </p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ---- Bottom: toolbar + timeline ---- */}
      <footer className="shrink-0 border-t border-border-soft bg-bg/80 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-1">
            <Tooltip content="Select / move">
              <IconBtn icon={MousePointer2} active />
            </Tooltip>
            <Tooltip content="Split clip at playhead" shortcut="S">
              <IconBtn icon={Scissors} onClick={split} />
            </Tooltip>
            <Tooltip content="Duplicate selection" shortcut="⌘D">
              <IconBtn icon={CopyPlus} onClick={duplicate} disabled={!hasSelection} />
            </Tooltip>
            <Tooltip content="Delete selection" shortcut="⌫">
              <IconBtn icon={Trash2} onClick={remove} disabled={!hasSelection && !state.selectedZoomId} />
            </Tooltip>
            <span className="mx-1 h-5 w-px bg-border-soft" />
            <Tooltip content="Add overlay track">
              <ToolbarButton icon={Layers} label="Add track" onClick={addTrack} />
            </Tooltip>
            <Tooltip content="Add audio track">
              <ToolbarButton icon={Music} label="Add audio" onClick={addAudio} />
            </Tooltip>
            <Tooltip content="Add cinematic zoom at playhead">
              <ToolbarButton icon={ZoomIn} label="Add zoom" onClick={addZoom} />
            </Tooltip>
            <Tooltip content={`Snapping ${state.snapping ? "on" : "off"}`} shortcut="N">
              <IconBtn icon={Magnet} active={state.snapping} onClick={() => dispatch({ type: "TOGGLE_SNAP" })} />
            </Tooltip>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted">{fmt(currentTime)}</span>
            <Tooltip content={playing ? "Pause" : "Play"} shortcut="Space">
              <button
                onClick={togglePlay}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-fg hover:bg-surface-3"
              >
                {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
              </button>
            </Tooltip>
            <span className="font-mono text-xs text-muted">{fmt(total)}</span>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip content="Zoom out">
              <IconBtn icon={ZoomOut} onClick={zoomOut} />
            </Tooltip>
            <span className="w-10 text-center text-xs text-muted">{zoomPct}%</span>
            <Tooltip content="Zoom in">
              <IconBtn icon={ZoomIn} onClick={zoomIn} />
            </Tooltip>
            <Tooltip content="Fit to window">
              <IconBtn icon={Maximize} onClick={zoomFit} />
            </Tooltip>
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto px-4 pb-4">
          {state.tracks.some((t) => t.clips.length) ? (
            <Timeline state={state} dispatch={dispatch} currentTime={currentTime} onSeek={handleSeek} />
          ) : (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">
              <Plus size={16} className="mr-2" /> No clips yet
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

function IconBtn({
  icon: Icon,
  onClick,
  active,
  disabled,
}: {
  icon: typeof Undo2;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition",
        disabled
          ? "cursor-not-allowed text-faint opacity-50"
          : active
            ? "bg-surface-2 text-accent"
            : "text-muted hover:bg-surface-2 hover:text-fg"
      )}
    >
      <Icon size={15} />
    </button>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Layers;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-fg"
    >
      <Icon size={14} /> {label}
    </button>
  );
}

const SUGGESTIONS = [
  "Make a 30-second product demo",
  "Animate a chart of our revenue growth",
  "Create a YouTube intro for my channel",
  "Build an explainer video on how solar panels work",
];

function ChatPanel({ credits }: { credits: number }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
        <span className="text-sm font-semibold">New chat</span>
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
          <Plus size={15} />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <div className="mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-accent/40 to-accent/5" />
        <h3 className="font-semibold">Let's create some animations</h3>
        <p className="mt-1 text-xs text-muted">
          Tell me the video you want. I'll generate every scene, narration, and animation for you.
        </p>
        <div className="mt-5 w-full space-y-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="w-full rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-xs text-muted transition hover:border-accent/40 hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2 border-t border-border-soft p-3">
        <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs">
          <span className="text-muted">{credits} credits remaining</span>
          <Link to="/billing" className="font-semibold text-accent hover:underline">
            Upgrade
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-surface-2 p-2">
          <textarea
            rows={2}
            placeholder="Describe a scene or edit the whole video"
            className="w-full resize-none bg-transparent px-1 text-sm text-fg outline-none placeholder:text-faint"
          />
        </div>
      </div>
    </div>
  );
}

function EditPanel({
  state,
  dispatch,
}: {
  state: ReturnType<typeof createInitialState>;
  dispatch: React.Dispatch<import("@/lib/editor/editorStore").EditorAction>;
}) {
  const sceneClips = state.tracks
    .filter((t) => t.kind === "scene")
    .flatMap((t) => t.clips)
    .filter((c) => c.type === "scene");
  const selectedId = state.selection[0];
  const selected = sceneClips.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-soft px-4 py-3 text-sm font-semibold">Edit</div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">Scenes</p>
          <div className="space-y-1.5">
            {sceneClips.map((c) => (
              <button
                key={c.id}
                onClick={() => dispatch({ type: "SELECT", ids: [c.id] })}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition",
                  c.id === selectedId
                    ? "border-accent bg-surface-2"
                    : "border-border bg-surface-2/40 hover:border-accent/40"
                )}
              >
                <span className="flex-1 truncate text-fg">{c.label ?? c.scene?.text}</span>
                <span className="text-faint">{c.duration.toFixed(1)}s</span>
              </button>
            ))}
          </div>
        </div>

        {selected && selected.scene && (
          <div className="space-y-3 rounded-xl border border-border bg-surface-2/40 p-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Text</span>
              <textarea
                rows={2}
                value={selected.scene.text}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CLIP",
                    clipId: selected.id,
                    patch: {
                      label: e.target.value,
                      scene: { ...selected.scene!, text: e.target.value },
                    },
                  })
                }
                className="w-full resize-none rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Duration (s)</span>
              <input
                type="number"
                min={0.2}
                step={0.1}
                value={selected.duration}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CLIP",
                    clipId: selected.id,
                    patch: { duration: Math.max(0.2, Number(e.target.value) || 0.2) },
                  })
                }
                className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderPanel({ id }: { id: PanelId }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-soft px-4 py-3 text-sm font-semibold capitalize">{id}</div>
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted">
        {id} panel — coming soon.
      </div>
    </div>
  );
}
