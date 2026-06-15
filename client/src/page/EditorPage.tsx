import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  CopyPlus,
  Download,
  Film,
  History,
  Image as ImageIcon,
  Layers,
  Library,
  Magnet,
  Maximize,
  MessageSquare,
  Monitor,
  MousePointer2,
  Music,
  Palette,
  Paperclip,
  SlidersHorizontal,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  Settings,
  Shapes,
  Sparkles,
  Trash2,
  Type as TypeIcon,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { useMe, useProject, useUpdateProject, useGenerateProject, useRerender, useDeleteProject } from "@/lib/queries";
import { Timeline } from "@/components/project/Timeline";
import { RenderedPreview } from "@/components/canvas/RenderedPreview";
import { LayersPanel } from "@/components/canvas/LayersPanel";
import { ElementsPanel, PropertiesPanel } from "@/components/canvas/panels";
import { RenderErrorDetails } from "@/components/project/RenderErrorDetails";
import { Tooltip } from "@/components/ui/Tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEditorShortcuts } from "@/lib/editor/useEditorShortcuts";
import {
  canRedo,
  canUndo,
  createInitialState,
  currentSceneClipId,
  editorReducer,
  findClip,
  toTimeline,
  totalDuration,
} from "@/lib/editor/editorStore";
import { DEFAULT_PX_PER_SECOND, FPS, type SceneElement } from "@/lib/editor/editorTypes";
import { cn } from "@/lib/utils";
import type { VideoPlan } from "@/types";

type PanelId = "chat" | "edit" | "layers" | "media" | "fonts" | "colors" | "projects";

const RAIL: { id: PanelId; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "edit", label: "Edit", icon: SlidersHorizontal },
  { id: "layers", label: "Layers", icon: Layers },
  { id: "media", label: "Media", icon: Library },
  { id: "fonts", label: "Fonts", icon: TypeIcon },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "projects", label: "Projects", icon: Library },
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
  const generate = useGenerateProject(id);
  const rerender = useRerender();
  const deleteProject = useDeleteProject();
  const navigate = useNavigate();

  const handleDelete = () => {
    if (!project) return;
    const label = project.prompt
      ? project.prompt.slice(0, 80) + (project.prompt.length > 80 ? "…" : "")
      : "this project";
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast.success("Project deleted");
        navigate("/projects");
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };

  const [state, dispatch] = useReducer(editorReducer, EMPTY_STATE);
  const [panel, setPanel] = useState<PanelId>("chat");
  // Mobile-only: which of Chat / Preview is shown full-bleed. Above md both
  // are visible side-by-side and this flag is ignored.
  const [mobileView, setMobileView] = useState<"chat" | "preview">("preview");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [awaitingGen, setAwaitingGen] = useState(false);
  const [showRenderedVideo, setShowRenderedVideo] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const lastSavedRef = useRef<string>("");
  const genBaselineRef = useRef<string>("");
  /** Track the previous status so we can detect the RENDERING → DONE transition
   *  and auto-open the rendered-video modal. */
  const prevStatusRef = useRef<string | null>(null);

  const editable = project ? project.status !== "QUEUED" && project.status !== "RENDERING" : false;
  const total = totalDuration(state);
  const generating =
    awaitingGen || project?.status === "PLANNING" || project?.status === "GENERATING_ASSETS";

  const sceneClipId = useMemo(
    () => currentSceneClipId(state.tracks, currentTime),
    [state.tracks, currentTime]
  );
  const sceneClip = sceneClipId ? findClip(state.tracks, sceneClipId)?.clip ?? null : null;
  const elements: SceneElement[] = sceneClip?.scene?.elements ?? [];
  const sceneNumber = useMemo(() => {
    const track = state.tracks.find((t) => t.kind === "scene");
    if (!track || !sceneClipId) return 1;
    const idx = track.clips
      .slice()
      .sort((a, b) => a.start - b.start)
      .findIndex((c) => c.id === sceneClipId);
    return idx >= 0 ? idx + 1 : 1;
  }, [state.tracks, sceneClipId]);

  // Active audio clip under the playhead (for voiceover sync). Mute respects
  // the parent track's `muted` flag so the editor preview matches the render.
  const activeAudio = useMemo(() => {
    for (const track of state.tracks) {
      if (track.kind !== "audio") continue;
      for (const clip of track.clips) {
        if (
          clip.type === "audio" &&
          clip.src &&
          currentTime >= clip.start &&
          currentTime < clip.start + clip.duration
        ) {
          return { clip, track };
        }
      }
    }
    return null;
  }, [state.tracks, currentTime]);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Keep the <audio> element's src bound to the active clip. When the user
  // scrubs out of range, pause but don't change the src (avoids reloads).
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (activeAudio?.clip.src && el.src !== activeAudio.clip.src) {
      el.src = activeAudio.clip.src;
    }
    el.volume = activeAudio?.track.muted
      ? 0
      : Math.max(0, Math.min(1, activeAudio?.clip.volume ?? 1));
  }, [activeAudio]);

  // Sync currentTime + play/pause with the playhead.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !activeAudio) {
      audioRef.current?.pause();
      return;
    }
    const desired =
      currentTime - activeAudio.clip.start + (activeAudio.clip.trimStart ?? 0);
    if (Math.abs(el.currentTime - desired) > 0.18) el.currentTime = Math.max(0, desired);
    if (playing && el.paused) el.play().catch(() => {});
    if (!playing && !el.paused) el.pause();
  }, [playing, currentTime, activeAudio]);

  // Load (and reload) the store whenever the project's *scenes* change. This
  // covers the first load, create-time generation, and in-editor chat
  // generation. Autosave only mutates the timeline (not top-level scenes), so
  // its server echo won't trigger an unwanted reload.
  const loadedScenesSig = useRef<string | null>(null);
  useEffect(() => {
    if (!project) return;
    const scenesSig = JSON.stringify(project.sceneJson?.scenes ?? null);
    if (scenesSig === loadedScenesSig.current) return;
    const hadScenes = loadedScenesSig.current !== null;
    loadedScenesSig.current = scenesSig;
    initRef.current = true;
    dispatch({
      type: "RESET",
      state: createInitialState(
        project.sceneJson?.scenes ?? [],
        project.sceneJson?.timeline ?? null,
        project.voiceoverUrl && project.voiceoverDuration
          ? { url: project.voiceoverUrl, duration: project.voiceoverDuration }
          : null
      ),
    });
    lastSavedRef.current = "";
    if (awaitingGen) {
      setAwaitingGen(false);
      if (project.sceneJson?.scenes?.length) toast.success("Scenes generated — edit them on the canvas");
    } else if (hadScenes && project.sceneJson?.scenes?.length) {
      toast.success("Scenes ready");
    }
  }, [project, awaitingGen]);

  // Debounced autosave of the timeline + elements.
  useEffect(() => {
    if (!initRef.current || !project?.sceneJson || !editable || awaitingGen) return;
    const timeline = toTimeline(state, FPS);
    const serialized = JSON.stringify(timeline);
    if (lastSavedRef.current === "") {
      lastSavedRef.current = serialized;
      return;
    }
    if (serialized === lastSavedRef.current) return;
    const handle = setTimeout(() => {
      lastSavedRef.current = serialized;
      const sceneJson: VideoPlan = {
        ...project.sceneJson!,
        duration: Math.max(1, Math.round(timeline.duration)),
        timeline,
      };
      genBaselineRef.current = JSON.stringify({ ...project.sceneJson, timeline });
      updateProject.mutate({ sceneJson });
    }, 800);
    return () => clearTimeout(handle);
  }, [state.tracks, state.zoomRegions, editable, project, updateProject, awaitingGen]);

  // Auto-open rendered-video popup when render finishes.
  useEffect(() => {
    if (!project) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = project.status;
    if (
      prev &&
      (prev === "RENDERING" || prev === "QUEUED") &&
      project.status === "DONE" &&
      project.outputUrl
    ) {
      setShowRenderedVideo(true);
    }
  }, [project]);

  // Virtual playback clock.
  useEffect(() => {
    if (!playing) return;
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
  }, [playing, total]);

  const togglePlay = () => {
    if (currentTime >= total) setCurrentTime(0);
    setPlaying((p) => !p);
  };
  const handleSeek = (time: number) => setCurrentTime(Math.max(0, Math.min(total, time)));

  // Toolbar handlers (element-aware).
  const undo = () => dispatch({ type: "UNDO" });
  const redo = () => dispatch({ type: "REDO" });
  const split = () => dispatch({ type: "SPLIT_AT", time: currentTime });
  const remove = () => {
    if (state.selectedElementIds.length && sceneClipId)
      dispatch({ type: "DELETE_ELEMENT", clipId: sceneClipId });
    else dispatch({ type: "DELETE_SELECTED" });
  };
  const duplicate = () => {
    if (state.selectedElementIds.length && sceneClipId) {
      for (const elId of state.selectedElementIds) {
        const el = elements.find((e) => e.id === elId);
        if (!el) continue;
        const { id: _id, ...rest } = el;
        dispatch({
          type: "ADD_ELEMENT",
          clipId: sceneClipId,
          elementType: el.type,
          element: { ...rest, x: Math.min(0.9, el.x + 0.03), y: Math.min(0.9, el.y + 0.03) },
        });
      }
    } else dispatch({ type: "DUPLICATE_SELECTED" });
  };
  const addElement = (elementType: SceneElement["type"]) => {
    if (sceneClipId) dispatch({ type: "ADD_ELEMENT", clipId: sceneClipId, elementType });
    else toast.error("Generate or add a scene first");
  };
  const addTrack = () => dispatch({ type: "ADD_TRACK", kind: "overlay" });
  const addAudio = () => dispatch({ type: "ADD_TRACK", kind: "audio" });
  const addZoom = () =>
    dispatch({ type: "ADD_ZOOM", start: currentTime, end: Math.min(total, currentTime + 2) });
  const zoomIn = () => dispatch({ type: "SET_PX_PER_SECOND", value: Math.round(state.pxPerSecond * 1.4) });
  const zoomOut = () => dispatch({ type: "SET_PX_PER_SECOND", value: Math.round(state.pxPerSecond / 1.4) });
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
    stepFrame: (frames) => {
      // 30 fps matches backend/remotion/Root.jsx.
      const FPS = 30;
      setCurrentTime((t) =>
        Math.max(0, Math.min(total, t + frames / FPS))
      );
      setPlaying(false);
    },
    jumpToStart: () => {
      setCurrentTime(0);
      setPlaying(false);
    },
    jumpToEnd: () => {
      setCurrentTime(total);
      setPlaying(false);
    },
  });

  const runGenerate = async (prompt: string, durationSec: number, referenceImage?: string) => {
    if (!project) return;
    if (prompt.trim().length < 10) {
      toast.error("Describe the video — at least a sentence.");
      return;
    }
    try {
      genBaselineRef.current = JSON.stringify(project.sceneJson ?? null);
      setAwaitingGen(true);
      await generate.mutateAsync({ prompt, durationSec, referenceImage });
    } catch (e) {
      setAwaitingGen(false);
      toast.error(e instanceof Error ? e.message : "Generation failed");
    }
  };

  const handleRender = async () => {
    if (!project) return;
    try {
      if (project.sceneJson) {
        const timeline = toTimeline(state, FPS);
        await updateProject.mutateAsync({
          sceneJson: {
            ...project.sceneJson,
            duration: Math.max(1, Math.round(timeline.duration)),
            timeline,
          },
        });
      }
      await rerender.mutateAsync(project.id);
      toast.success("Render started — this can take a minute.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the render");
    }
  };

  if (!meLoading && !me) return <Navigate to="/login" replace />;
  if (meLoading || isLoading) {
    return <div className="flex h-screen items-center justify-center bg-bg text-muted">Loading editor…</div>;
  }
  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg">
        <p className="text-fg">Project not found</p>
        <Link to="/projects" className="text-sm text-accent hover:underline">Back to projects</Link>
      </div>
    );
  }

  const brand = project.sceneJson?.brandColors ?? ["#0f172a", "#8b5cf6", "#38bdf8"];
  const hasSelection = state.selection.length > 0 || state.selectedElementIds.length > 0;
  const zoomPct = Math.round((state.pxPerSecond / DEFAULT_PX_PER_SECOND) * 100);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-fg">
      {/* ---- Top bar — actions always visible, left side truncates. ---- */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-soft bg-bg/80 px-2 backdrop-blur sm:px-3">
        {/* Left: back arrow + truncating title. `min-w-0` lets the title
            actually shrink instead of pushing the action group off-screen. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Tooltip content="Back to projects" side="bottom">
            <Link to="/projects" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
              <ArrowLeft size={16} />
            </Link>
          </Tooltip>
          <span className="mx-1 hidden h-5 w-px shrink-0 bg-border-soft sm:block" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium md:max-w-[40vw]">{project.prompt || "Untitled Project"}</span>
          {/* Aspect ratio badge — hide on narrow screens, shown again from sm. */}
          <Tooltip content="Aspect ratio" side="bottom">
            <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs text-muted sm:flex">
              <Monitor size={13} /> {project.aspectRatio}
            </span>
          </Tooltip>
          {updateProject.isPending && (
            <span className="hidden shrink-0 text-[11px] text-faint md:inline">Saving…</span>
          )}
          {!project.voiceoverUrl && project.voiceoverError && (
            <Tooltip content={`Voiceover was skipped: ${project.voiceoverError}`} side="bottom">
              <span className="hidden shrink-0 rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning lg:inline">
                Narration unavailable
              </span>
            </Tooltip>
          )}
        </div>

        {/* Right: download + render + theme. `shrink-0` so it can never be
            clipped, no matter how long the title is. */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Mobile-only toggle between Chat and Preview. Hidden from md up
              because both panels are visible side-by-side there. */}
          <Tooltip content={mobileView === "chat" ? "Show preview" : "Show chat"} side="bottom">
            <button
              onClick={() => setMobileView((v) => (v === "chat" ? "preview" : "chat"))}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs font-medium text-fg hover:border-accent/40 md:hidden"
            >
              {mobileView === "chat" ? <Monitor size={13} /> : <MessageSquare size={13} />}
              <span className="hidden sm:inline">
                {mobileView === "chat" ? "Preview" : "Chat"}
              </span>
            </button>
          </Tooltip>
          <RenderErrorDetails project={project} onRetry={handleRender} />
          <Tooltip content="Delete project" side="bottom">
            <button
              onClick={handleDelete}
              disabled={deleteProject.isPending}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2 text-xs font-medium text-fg hover:border-danger/50 hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
              aria-label="Delete project"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">
                {deleteProject.isPending ? "Deleting…" : "Delete"}
              </span>
            </button>
          </Tooltip>
          {project.status === "DONE" && project.outputUrl && (
            <>
              <Tooltip content="Watch rendered video" side="bottom">
                <button
                  onClick={() => setShowRenderedVideo(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs font-medium text-fg hover:border-accent/40 sm:px-3"
                >
                  <Play size={13} />
                  <span className="hidden sm:inline">View Render</span>
                </button>
              </Tooltip>
              <Tooltip content="Download MP4" side="bottom">
                <a
                  href={project.outputUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs font-medium text-fg hover:border-accent/40 sm:px-3"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Download</span>
                </a>
              </Tooltip>
            </>
          )}
          <Tooltip content="Render the final MP4" side="bottom">
            <button
              onClick={handleRender}
              disabled={!editable || rerender.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-2 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
            >
              <Film size={13} />
              <span className="hidden sm:inline">
                {project.status === "RENDERING" || project.status === "QUEUED"
                  ? `Rendering ${project.progress}%`
                  : "Render"}
              </span>
              {/* Compact label for narrow screens. */}
              <span className="sm:hidden">
                {project.status === "RENDERING" || project.status === "QUEUED"
                  ? `${project.progress}%`
                  : ""}
              </span>
            </button>
          </Tooltip>
          <ThemeToggle className="ml-1 h-7 w-7" />
        </div>
      </header>

      {/* ---- Body — on mobile, only one of {Chat, Preview} is shown at a
           time (toggle in the header). From md up, both are side-by-side. ---- */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Chat: full-screen on mobile (when selected); fixed side panel on md+. */}
        <aside
          className={cn(
            // Desktop: fixed-width side panel that never grows. We use
            // `md:!flex-none` so the `flex-1` we add for mobile can't leak
            // into desktop and push the preview off-screen.
            "flex-col border-r border-border-soft bg-bg/40 md:flex md:!flex-none md:h-auto md:w-64 md:shrink-0 lg:w-72 xl:w-80",
            mobileView === "chat" ? "flex flex-1" : "hidden md:flex"
          )}
        >
          <ChatPanel
            credits={me?.credits ?? 0}
            aspectRatio={project.aspectRatio}
            defaultDuration={project.durationSec}
            generating={generating}
            onGenerate={runGenerate}
          />
        </aside>

        {/* Preview — Canvas with LivePreview is the primary editing surface.
            The actual Remotion <Player> renders the scene in real time
            and draggable element overlays sit on top. After render the MP4
            opens in a popup — it never replaces this canvas. */}
        <main
          className={cn(
            "relative min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#0a0a0f] p-1 sm:p-2 md:flex md:p-3",
            mobileView === "preview" ? "flex" : "hidden md:flex"
          )}
        >
          <div
            ref={previewRef}
            className={cn(
              "relative overflow-hidden rounded-xl shadow-2xl",
              project.aspectRatio === "16:9" && "aspect-video w-full max-w-full",
              project.aspectRatio === "9:16" && "mx-auto aspect-[9/16] h-full max-h-full",
              project.aspectRatio === "1:1" && "mx-auto aspect-square h-full max-h-full",
              project.aspectRatio === "4:3" && "aspect-[4/3] w-full max-w-full"
            )}
            style={{ backgroundColor: brand[0] ?? "#0a0a0f" }}
          >
            {/* Code-gen model: the project IS a rendered MP4. We play the
                rendered video (or show generate/render status) — no live
                element editing. */}
            <RenderedPreview
              project={project}
              currentTime={currentTime}
              playing={playing}
              onTimeUpdate={setCurrentTime}
              onRetry={handleRender}
            />

            {/* Rendering / generating overlays */}
            {(project.status === "RENDERING" || project.status === "QUEUED") && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center pb-4">
                <div className="flex items-center gap-2 rounded-full bg-bg/80 px-4 py-2 text-xs text-muted backdrop-blur-sm">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent/40 border-t-accent" />
                  Rendering {project.progress ? `${project.progress}%` : "…"}
                </div>
              </div>
            )}
          </div>
          {generating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/60 backdrop-blur-sm">
              <Sparkles size={28} className="animate-pulse text-accent" />
              <p className="text-sm text-muted">Generating your scenes…</p>
            </div>
          )}
        </main>

        {/* Right sidebar — Layers / Properties / Elements panels. */}
        <aside
          className={cn(
            "hidden flex-col border-l border-border-soft bg-bg/40 md:flex md:w-56 md:shrink-0 lg:w-64",
            mobileView === "preview" ? "" : ""
          )}
        >
          {/* Panel tabs */}
          <div className="flex border-b border-border-soft">
            {([
              { id: "layers" as const, label: "Layers", icon: Layers },
              { id: "edit" as const, label: "Props", icon: SlidersHorizontal },
              { id: "media" as const, label: "Add", icon: Plus },
            ] as const).map((tab) => {
              const Icon = tab.icon;
              const active = panel === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setPanel(tab.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition",
                    active
                      ? "border-b-2 border-accent text-fg"
                      : "text-muted hover:text-fg"
                  )}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel === "layers" && (
              <LayersPanel
                clipId={sceneClipId}
                elements={elements}
                selectedIds={state.selectedElementIds}
                dispatch={dispatch}
              />
            )}
            {panel === "edit" && (
              <PropertiesPanel
                clipId={sceneClipId}
                elements={elements}
                selectedIds={state.selectedElementIds}
                dispatch={dispatch}
                selectedClip={
                  state.selection.length === 1
                    ? findClip(state.tracks, state.selection[0])?.clip ?? null
                    : null
                }
                sceneClip={sceneClip}
              />
            )}
            {panel === "media" && (
              <ElementsPanel clipId={sceneClipId} dispatch={dispatch} />
            )}
          </div>
        </aside>
      </div>

      {/* ---- Bottom: play controls + timeline view (read-only-ish) ---- */}
      <footer className="shrink-0 border-t border-border-soft bg-bg/80 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2 py-2 sm:px-4">
          <span className="font-mono text-xs text-muted">{fmt(currentTime)}</span>
          <Tooltip content={playing ? "Pause" : "Play"} shortcut="Space">
            <button onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-fg hover:bg-surface-3">
              {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
          </Tooltip>
          <span className="font-mono text-xs text-muted">{fmt(total)}</span>
          <div className="ml-auto hidden items-center gap-1 sm:flex">
            <Tooltip content="Zoom out"><IconBtn icon={ZoomOut} onClick={zoomOut} /></Tooltip>
            <span className="w-10 text-center text-xs text-muted">{zoomPct}%</span>
            <Tooltip content="Zoom in"><IconBtn icon={ZoomIn} onClick={zoomIn} /></Tooltip>
            <Tooltip content="Fit to window"><IconBtn icon={Maximize} onClick={zoomFit} /></Tooltip>
          </div>
        </div>

        <div className="max-h-60 overflow-auto px-2 pb-3 sm:px-4 sm:pb-4">
          {state.tracks.some((t) => t.clips.length) ? (
            <Timeline state={state} dispatch={dispatch} currentTime={currentTime} onSeek={handleSeek} />
          ) : (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">
              <Plus size={16} className="mr-2" /> No clips yet — generate a video in the chat
            </div>
          )}
        </div>
      </footer>

      {/* Hidden narration <audio> driven by the playhead. */}
      <audio ref={audioRef} preload="auto" />

      {/* ---- Rendered video popup modal ---- */}
      {showRenderedVideo && project.outputUrl && (
        <RenderedVideoModal
          url={project.outputUrl}
          onClose={() => setShowRenderedVideo(false)}
        />
      )}
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, active, disabled }: { icon: typeof Undo2; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition",
        disabled ? "cursor-not-allowed text-faint opacity-50" : active ? "bg-surface-2 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"
      )}
    >
      <Icon size={15} />
    </button>
  );
}

function ToolbarButton({ icon: Icon, label, onClick }: { icon: typeof Layers; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-fg">
      <Icon size={14} /> {label}
    </button>
  );
}

function AddElementMenu({ onAdd, disabled }: { onAdd: (t: SceneElement["type"]) => void; disabled?: boolean }) {
  const items: { type: SceneElement["type"]; label: string; icon: typeof TypeIcon }[] = [
    { type: "text", label: "Text", icon: TypeIcon },
    { type: "icon", label: "Icon", icon: Sparkles },
    { type: "image", label: "Image", icon: ImageIcon },
    { type: "shape", label: "Shape", icon: Shapes },
  ];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={13} /> Add <ChevronDown size={12} className="opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.type}
              onClick={() => onAdd(it.type)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-fg hover:bg-surface-2"
            >
              <Icon size={15} className="text-muted" /> {it.label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

const SUGGESTIONS = [
  "Make a 30-second product demo",
  "Animate a chart of our revenue growth",
  "Create a YouTube intro for my channel",
  "Build an explainer video on how solar panels work",
];

function ChatPanel({
  credits,
  aspectRatio,
  defaultDuration,
  generating,
  onGenerate,
}: {
  credits: number;
  aspectRatio: string;
  defaultDuration: number;
  generating: boolean;
  onGenerate: (prompt: string, durationSec: number, referenceImage?: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refName, setRefName] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const generationDuration = Math.max(1, defaultDuration || 15);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4 MB");
      return;
    }
    setRefName(file.name);
    const reader = new FileReader();
    reader.onload = () => setRefImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const submit = () => {
    onGenerate(prompt, generationDuration, refImage ?? undefined);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
        <span className="text-sm font-semibold">New chat</span>
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
          <Plus size={15} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <div className="mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-accent/50 to-accent/5 shadow-[0_0_40px] shadow-accent/30" />
        <h3 className="font-semibold">Let's create some animations</h3>
        <p className="mt-1 text-xs text-muted">
          Tell me the video you want. I'll generate every scene, narration, and animation for you.
        </p>
        <div className="mt-5 w-full space-y-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setPrompt(s)}
              className="w-full rounded-full border border-border bg-surface-2/60 px-3 py-2 text-xs text-muted transition hover:border-accent/40 hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-border-soft p-3">
        <div className="flex items-center justify-between rounded-lg bg-warning/10 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <Sparkles size={13} className="text-accent" /> {credits} credits remaining
          </span>
          <Link to="/billing" className="rounded-md border border-border bg-surface-2 px-2 py-1 font-semibold text-fg hover:border-accent/40">
            Upgrade
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-2">
          <div className="mb-2 flex items-center justify-end">
            <span className="flex items-center gap-1 rounded-md border border-border bg-surface-3 px-2 py-1 text-xs text-muted">
              <Monitor size={12} /> {aspectRatio}
            </span>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Describe a scene or edit the whole video"
            className="w-full resize-none bg-transparent px-1 text-sm text-fg outline-none placeholder:text-faint"
          />
          {/* Reference image preview */}
          {refImage && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface-3/50 p-1.5">
              <img src={refImage} alt="ref" className="h-12 w-12 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <div className="truncate text-[11px] text-fg">{refName}</div>
                <div className="text-[10px] text-faint">Design reference — layout, colors & style only (not content)</div>
              </div>
              <button onClick={() => { setRefImage(null); setRefName(""); }} className="shrink-0 rounded p-1 text-faint hover:text-danger">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg" title="Attach reference image">
              <Plus size={14} />
            </button>
            <button
              onClick={submit}
              disabled={generating || prompt.trim().length < 10}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              title="Generate"
            >
              {generating ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-ink/40 border-t-accent-ink" />
              ) : (
                <ArrowUp size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenePanel({
  state,
  currentTime,
  onSeek,
}: {
  state: ReturnType<typeof createInitialState>;
  currentTime: number;
  onSeek: (t: number) => void;
}) {
  const sceneTrack = state.tracks.find((t) => t.kind === "scene");
  const clips = sceneTrack?.clips.slice().sort((a, b) => a.start - b.start) ?? [];
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-soft px-4 py-3 text-sm font-semibold">Scenes</div>
      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {clips.map((c, i) => {
          const active = currentTime >= c.start && currentTime < c.start + c.duration;
          return (
            <button
              key={c.id}
              onClick={() => onSeek(c.start + 0.01)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition",
                active ? "border-accent bg-surface-2" : "border-border bg-surface-2/40 hover:border-accent/40"
              )}
            >
              <span className="font-bold text-accent-soft">{i + 1}</span>
              <span className="flex-1 truncate text-fg">{c.label ?? c.scene?.text ?? "Scene"}</span>
              <span className="text-faint">{c.duration.toFixed(1)}s</span>
            </button>
          );
        })}
        {!clips.length && <p className="px-1 text-xs text-faint">No scenes yet — generate in Chat.</p>}
      </div>
    </div>
  );
}

function PlaceholderPanel({ id }: { id: PanelId }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-soft px-4 py-3 text-sm font-semibold capitalize">{id}</div>
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted">{id} panel — coming soon.</div>
    </div>
  );
}

/**
 * Full-screen modal that plays the rendered MP4. Opens automatically when a
 * render finishes, and can be re-opened from the "View Render" header button.
 * The canvas underneath stays fully editable — the rendered video never
 * replaces the editing surface.
 */
function RenderedVideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Film size={16} className="text-accent" />
            Rendered Video
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg hover:border-accent/40"
            >
              <Download size={13} />
              Download
            </a>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        {/* Video */}
        <div className="bg-black p-2">
          <video
            src={url}
            controls
            autoPlay
            className="mx-auto max-h-[70vh] w-full rounded-lg"
            style={{ objectFit: "contain" }}
          />
        </div>
      </div>
    </div>
  );
}

