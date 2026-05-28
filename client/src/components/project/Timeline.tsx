import { useMemo, useRef } from "react";
import type { Scene } from "@/types";
import { cn } from "@/lib/utils";

interface TimelineProps {
  scenes: Scene[];
  /** Current playback time in seconds. */
  currentTime: number;
  /** Index of the scene the user has selected (for the inspector), if any. */
  selectedIndex?: number | null;
  /** Seek to a time in seconds (e.g. wired to the <video> element). */
  onSeek?: (time: number) => void;
  /** Select a scene (click on a clip). */
  onSelectScene?: (index: number) => void;
}

const CLIP_COLORS = [
  "#8b5cf6",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#f97316",
];

function fmt(time: number) {
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Timeline({
  scenes,
  currentTime,
  selectedIndex,
  onSeek,
  onSelectScene,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Cumulative start time + total duration from each scene's length.
  const { clips, total } = useMemo(() => {
    let acc = 0;
    const out = scenes.map((scene, index) => {
      const duration = Math.max(0.1, Number(scene.duration) || 4);
      const start = acc;
      acc += duration;
      return { scene, index, start, duration };
    });
    return { clips: out, total: acc };
  }, [scenes]);

  // One ruler tick per second (cap label density on long videos).
  const ticks = useMemo(() => {
    const step = total > 30 ? 5 : total > 15 ? 2 : 1;
    const out: number[] = [];
    for (let t = 0; t <= total; t += step) out.push(t);
    return out;
  }, [total]);

  const activeIndex = clips.findIndex(
    (c) => currentTime >= c.start && currentTime < c.start + c.duration
  );

  const seekFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !onSeek) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(ratio * total);
  };

  const playheadPercent = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Timeline
        </h2>
        <span className="font-mono text-xs text-faint">
          {fmt(currentTime)} / {fmt(total)}
        </span>
      </div>

      {/* Ruler */}
      <div className="relative mb-1 h-4 select-none">
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-0 flex h-full flex-col items-center"
            style={{ left: `${(t / total) * 100}%` }}
          >
            <div className="h-1.5 w-px bg-border" />
            <span className="mt-0.5 -translate-x-1/2 text-[10px] leading-none text-faint">
              {fmt(t)}
            </span>
          </div>
        ))}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onClick={(e) => seekFromClientX(e.clientX)}
        className="relative flex h-16 w-full cursor-pointer gap-1 overflow-hidden rounded-lg bg-surface-2 p-1"
      >
        {clips.map((clip) => {
          const widthPercent = (clip.duration / total) * 100;
          const color = CLIP_COLORS[clip.index % CLIP_COLORS.length];
          const isActive = clip.index === activeIndex;
          const isSelected = clip.index === selectedIndex;
          return (
            <button
              key={clip.index}
              type="button"
              title={`Scene ${clip.scene.scene} · ${clip.duration}s`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectScene?.(clip.index);
                onSeek?.(clip.start + 0.001);
              }}
              style={{ width: `${widthPercent}%`, backgroundColor: `${color}22`, borderColor: color }}
              className={cn(
                "group relative flex h-full min-w-0 flex-col justify-between overflow-hidden rounded-md border px-2 py-1.5 text-left transition",
                isActive ? "ring-2 ring-accent ring-offset-1 ring-offset-surface-2" : "",
                isSelected ? "brightness-110" : "opacity-90 hover:opacity-100"
              )}
            >
              <span
                className="truncate text-[11px] font-semibold"
                style={{ color }}
              >
                {clip.scene.scene}. {clip.scene.text || clip.scene.headline || "Scene"}
              </span>
              <span className="truncate text-[10px] text-muted">
                {clip.duration}s · {clip.scene.animation}
              </span>
            </button>
          );
        })}

        {/* Playhead */}
        <div
          className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-accent"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-accent" />
        </div>
      </div>
    </div>
  );
}
