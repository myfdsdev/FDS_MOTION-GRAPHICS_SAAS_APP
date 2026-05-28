import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  History,
  Layers,
  Library,
  MessageSquare,
  Monitor,
  MousePointer2,
  Music,
  Palette,
  Pause,
  Play,
  Plus,
  Redo2,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Type,
  Undo2,
  Upload,
  ZoomIn,
} from "lucide-react";
import { useMe, useProject } from "@/lib/queries";
import { Timeline } from "@/components/project/Timeline";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import type { Scene } from "@/types";

type PanelId =
  | "chat"
  | "edit"
  | "media"
  | "fonts"
  | "colors"
  | "projects"
  | "templates";

const RAIL: { id: PanelId; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "edit", label: "Edit", icon: SlidersHorizontal },
  { id: "media", label: "Media", icon: Library },
  { id: "fonts", label: "Fonts", icon: Type },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "projects", label: "Projects", icon: Library },
  { id: "templates", label: "Templates", icon: Sparkles },
];

function fmt(time: number) {
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: project, isLoading } = useProject(id);

  const [panel, setPanel] = useState<PanelId>("chat");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100);

  const videoRef = useRef<HTMLVideoElement>(null);

  const scenes: Scene[] = project?.sceneJson?.scenes ?? [];
  const hasVideo = project?.status === "DONE" && Boolean(project.outputUrl);

  const total = useMemo(
    () => scenes.reduce((sum, s) => sum + Math.max(0.1, Number(s.duration) || 4), 0),
    [scenes]
  );

  const activeIndex = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < scenes.length; i++) {
      const d = Math.max(0.1, Number(scenes[i].duration) || 4);
      if (currentTime >= acc && currentTime < acc + d) return i;
      acc += d;
    }
    return scenes.length - 1;
  }, [scenes, currentTime]);

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
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onTime);
    el.addEventListener("play", () => setPlaying(true));
    el.addEventListener("pause", () => setPlaying(false));
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onTime);
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
    setCurrentTime(time);
    if (hasVideo && videoRef.current) videoRef.current.currentTime = time;
  };

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
  const activeScene = scenes[activeIndex];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-fg">
      {/* ---- Top bar ---- */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-soft bg-bg/80 px-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            to={`/projects/${project.id}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
            title="Back to project"
          >
            <ArrowLeft size={16} />
          </Link>
          <Link
            to="/dashboard"
            className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg sm:flex"
          >
            <Sparkles size={15} className="text-accent" /> Home
          </Link>
          <span className="mx-1 h-5 w-px bg-border-soft" />
          <span className="max-w-[40vw] truncate text-sm font-medium">
            {project.prompt || "Untitled Project"}
          </span>
          <button className="ml-1 flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs text-muted hover:text-fg">
            <Monitor size={13} /> {project.aspectRatio}
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
            <Settings size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <ToolbarIcon icon={Undo2} title="Undo" />
          <ToolbarIcon icon={Redo2} title="Redo" />
          <ToolbarIcon icon={History} title="History" />
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
          {panel === "edit" && (
            <EditPanel
              scenes={scenes}
              selectedIndex={selectedScene ?? activeIndex}
              onSelect={(i) => {
                setSelectedScene(i);
              }}
            />
          )}
          {panel !== "chat" && panel !== "edit" && (
            <PlaceholderPanel id={panel} />
          )}
        </aside>

        {/* Preview */}
        <main className="flex min-w-0 flex-1 items-center justify-center bg-[#0a0a0f] p-6">
          <div
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
                      <p className="mt-3 max-w-lg text-sm text-white/70">
                        {activeScene.subtext}
                      </p>
                    )}
                    <span className="mt-6 rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/50">
                      Scene {activeScene.scene} · {activeScene.animation} · preview
                    </span>
                  </>
                ) : (
                  <p className="text-sm text-white/60">
                    No scenes yet — generate a video to populate the timeline.
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
            <ToolbarIcon icon={MousePointer2} title="Select" active />
            <span className="mx-1 h-5 w-px bg-border-soft" />
            <ToolbarButton icon={Layers} label="Add track" />
            <ToolbarButton icon={Music} label="Add audio" />
            <ToolbarButton icon={ZoomIn} label="Add zoom" />
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted">{fmt(currentTime)}</span>
            <button
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-fg hover:bg-surface-3"
            >
              {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <span className="font-mono text-xs text-muted">{fmt(total)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-faint">Zoom</span>
            <input
              type="range"
              min={50}
              max={200}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1 w-28 accent-accent"
            />
            <span className="w-9 text-right text-xs text-muted">{zoom}%</span>
          </div>
        </div>

        <div className="max-h-56 overflow-x-auto overflow-y-hidden px-4 pb-4">
          {scenes.length > 0 ? (
            <Timeline
              scenes={scenes}
              currentTime={currentTime}
              selectedIndex={selectedScene}
              onSeek={handleSeek}
              onSelectScene={(i) => {
                setSelectedScene(i);
                setPanel("edit");
              }}
            />
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

function ToolbarIcon({
  icon: Icon,
  title,
  active,
}: {
  icon: typeof Undo2;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition",
        active ? "bg-surface-2 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"
      )}
    >
      <Icon size={15} />
    </button>
  );
}

function ToolbarButton({ icon: Icon, label }: { icon: typeof Layers; label: string }) {
  return (
    <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-fg">
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
          Tell me the video you want. I'll generate every scene, narration, and
          animation for you.
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
          <div className="mt-1 flex justify-end">
            <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-ink hover:bg-accent-hover">
              <ArrowLeft size={14} className="rotate-90" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditPanel({
  scenes,
  selectedIndex,
  onSelect,
}: {
  scenes: Scene[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  const scene = scenes[selectedIndex];
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-soft px-4 py-3 text-sm font-semibold">
        Edit
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">
            Scenes
          </p>
          <div className="space-y-1.5">
            {scenes.map((s, i) => (
              <button
                key={s.scene}
                onClick={() => onSelect(i)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition",
                  i === selectedIndex
                    ? "border-accent bg-surface-2"
                    : "border-border bg-surface-2/40 hover:border-accent/40"
                )}
              >
                <span className="font-bold text-accent-soft">{s.scene}</span>
                <span className="flex-1 truncate text-fg">{s.text}</span>
                <span className="text-faint">{s.duration}s</span>
              </button>
            ))}
          </div>
        </div>

        {scene && (
          <div className="space-y-3 rounded-xl border border-border bg-surface-2/40 p-3">
            <Field label="Text">
              <textarea
                rows={2}
                defaultValue={scene.text}
                className="w-full resize-none rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Duration (s)">
                <input
                  type="number"
                  defaultValue={scene.duration}
                  className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
                />
              </Field>
              <Field label="Animation">
                <input
                  defaultValue={scene.animation}
                  className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
                />
              </Field>
            </div>
            <p className="text-[11px] text-faint">
              Editing &amp; saving scenes is coming next — these reflect the current
              plan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function PlaceholderPanel({ id }: { id: PanelId }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-soft px-4 py-3 text-sm font-semibold capitalize">
        {id}
      </div>
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted">
        {id} panel — coming soon.
      </div>
    </div>
  );
}
