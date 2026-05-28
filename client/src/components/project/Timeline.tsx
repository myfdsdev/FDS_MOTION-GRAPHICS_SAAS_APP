import { useCallback, useMemo, useRef, useState } from "react";
import { Layers, Music, Trash2, Type as TypeIcon, ZoomIn } from "lucide-react";
import {
  RULER_HEIGHT,
  TRACK_HEIGHT,
  ZOOM_TRACK_HEIGHT,
  type EditorState,
  type TimelineClip,
  type TimelineTrack,
  type ZoomRegion,
} from "@/lib/editor/editorTypes";
import {
  clipColor,
  clipEnd,
  snapCandidates,
  snapValue,
  totalDuration,
} from "@/lib/editor/editorStore";
import type { EditorAction } from "@/lib/editor/editorStore";
import { cn } from "@/lib/utils";

const GAP = 6;
const TICK_STEPS = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];

interface TimelineProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  currentTime: number;
  onSeek: (time: number) => void;
}

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function pickTickStep(pps: number) {
  for (const step of TICK_STEPS) if (step * pps >= 64) return step;
  return TICK_STEPS[TICK_STEPS.length - 1];
}

export function Timeline({ state, dispatch, currentTime, onSeek }: TimelineProps) {
  const { tracks, zoomRegions, pxPerSecond: pps, snapping, selection, selectedZoomId } = state;
  const contentRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null
  );

  const total = totalDuration(state);
  const contentSeconds = total + 4;
  const contentWidth = Math.max(contentSeconds * pps, 600);

  const laneTop = useCallback(
    (i: number) => RULER_HEIGHT + GAP + i * (TRACK_HEIGHT + GAP),
    []
  );
  const zoomTop = RULER_HEIGHT + GAP + tracks.length * (TRACK_HEIGHT + GAP);
  const contentHeight = zoomTop + ZOOM_TRACK_HEIGHT + GAP;

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return Math.max(0, (clientX - rect.left) / pps);
    },
    [pps]
  );

  const makeCandidates = useCallback(
    (excludeId?: string) => snapCandidates(state, currentTime, excludeId),
    [state, currentTime]
  );

  // ---- Ruler scrub ----
  const scrubRef = useRef(false);
  const onRulerPointerDown = (e: React.PointerEvent) => {
    scrubRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    onSeek(timeFromClientX(e.clientX));
  };
  const onRulerPointerMove = (e: React.PointerEvent) => {
    if (scrubRef.current) onSeek(timeFromClientX(e.clientX));
  };
  const onRulerPointerUp = (e: React.PointerEvent) => {
    scrubRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  // ---- Marquee select ----
  const marqueeRef = useRef(false);
  const onLaneBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return; // only when hitting empty lane
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    marqueeRef.current = true;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMarquee({ x1: x, y1: y, x2: x, y2: y });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onLaneBackgroundPointerMove = (e: React.PointerEvent) => {
    if (!marqueeRef.current) return;
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMarquee((m) => (m ? { ...m, x2: e.clientX - rect.left, y2: e.clientY - rect.top } : m));
  };
  const onLaneBackgroundPointerUp = () => {
    if (!marqueeRef.current || !marquee) {
      marqueeRef.current = false;
      setMarquee(null);
      return;
    }
    const left = Math.min(marquee.x1, marquee.x2);
    const right = Math.max(marquee.x1, marquee.x2);
    const top = Math.min(marquee.y1, marquee.y2);
    const bottom = Math.max(marquee.y1, marquee.y2);
    const hits: string[] = [];
    tracks.forEach((track, i) => {
      const t = laneTop(i);
      const b = t + TRACK_HEIGHT;
      if (b < top || t > bottom) return;
      for (const clip of track.clips) {
        const cl = clip.start * pps;
        const cr = clipEnd(clip) * pps;
        if (cr >= left && cl <= right) hits.push(clip.id);
      }
    });
    dispatch({ type: "SELECT", ids: hits });
    marqueeRef.current = false;
    setMarquee(null);
  };

  const tickStep = pickTickStep(pps);
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= contentSeconds; t += tickStep) out.push(Number(t.toFixed(3)));
    return out;
  }, [contentSeconds, tickStep]);

  return (
    <div className="select-none rounded-xl border border-border bg-surface">
      <div className="flex">
        {/* Label gutter */}
        <div className="w-28 shrink-0 border-r border-border-soft bg-surface-2/40">
          <div style={{ height: RULER_HEIGHT + GAP }} />
          {tracks.map((track, i) => (
            <div
              key={track.id}
              style={{ height: TRACK_HEIGHT, marginBottom: GAP }}
              className="flex items-center gap-1.5 px-2 text-[11px] text-muted"
            >
              <TrackIcon kind={track.kind} />
              <span className="truncate">{track.name ?? track.kind}</span>
            </div>
          ))}
          <div
            style={{ height: ZOOM_TRACK_HEIGHT }}
            className="flex items-center gap-1.5 px-2 text-[11px] text-muted"
          >
            <ZoomIn size={12} /> Zoom
          </div>
        </div>

        {/* Scrollable content */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div
            ref={contentRef}
            className="relative"
            style={{ width: contentWidth, height: contentHeight }}
          >
            {/* Ruler */}
            <div
              className="absolute left-0 top-0 cursor-ew-resize"
              style={{ width: contentWidth, height: RULER_HEIGHT }}
              onPointerDown={onRulerPointerDown}
              onPointerMove={onRulerPointerMove}
              onPointerUp={onRulerPointerUp}
            >
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full" style={{ left: t * pps }}>
                  <div className="h-2 w-px bg-border" />
                  <span className="ml-1 text-[10px] leading-none text-faint">{fmt(t)}</span>
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((track, i) => (
              <div
                key={track.id}
                className="absolute rounded-md bg-surface-2/40"
                style={{ top: laneTop(i), left: 0, width: contentWidth, height: TRACK_HEIGHT }}
                onPointerDown={onLaneBackgroundPointerDown}
                onPointerMove={onLaneBackgroundPointerMove}
                onPointerUp={onLaneBackgroundPointerUp}
              >
                {track.clips.map((clip) => (
                  <Clip
                    key={clip.id}
                    clip={clip}
                    pps={pps}
                    snapping={snapping}
                    selected={selection.includes(clip.id)}
                    makeCandidates={makeCandidates}
                    dispatch={dispatch}
                  />
                ))}
              </div>
            ))}

            {/* Zoom lane */}
            <div
              className="absolute rounded-md bg-accent/5"
              style={{ top: zoomTop, left: 0, width: contentWidth, height: ZOOM_TRACK_HEIGHT }}
            >
              {zoomRegions.map((region) => (
                <ZoomBlock
                  key={region.id}
                  region={region}
                  pps={pps}
                  snapping={snapping}
                  selected={selectedZoomId === region.id}
                  makeCandidates={makeCandidates}
                  dispatch={dispatch}
                />
              ))}
            </div>

            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 z-20 w-0.5 bg-accent"
              style={{ left: currentTime * pps, height: contentHeight }}
            >
              <div className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-accent" />
            </div>

            {/* Marquee */}
            {marquee && (
              <div
                className="pointer-events-none absolute z-30 rounded border border-accent bg-accent/10"
                style={{
                  left: Math.min(marquee.x1, marquee.x2),
                  top: Math.min(marquee.y1, marquee.y2),
                  width: Math.abs(marquee.x2 - marquee.x1),
                  height: Math.abs(marquee.y2 - marquee.y1),
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackIcon({ kind }: { kind: TimelineTrack["kind"] }) {
  if (kind === "audio") return <Music size={12} />;
  if (kind === "overlay") return <TypeIcon size={12} />;
  return <Layers size={12} />;
}

// ---------------------------------------------------------------------------
// Clip
// ---------------------------------------------------------------------------

interface ClipProps {
  clip: TimelineClip;
  pps: number;
  snapping: boolean;
  selected: boolean;
  makeCandidates: (excludeId?: string) => number[];
  dispatch: React.Dispatch<EditorAction>;
}

function Clip({ clip, pps, snapping, selected, makeCandidates, dispatch }: ClipProps) {
  const drag = useRef<{
    mode: "move" | "trim-start" | "trim-end";
    startX: number;
    orig: number;
    candidates: number[];
  } | null>(null);
  const color = clipColor(clip.type);

  const begin = (mode: "move" | "trim-start" | "trim-end") => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    if (mode === "move") {
      dispatch({ type: "SELECT", ids: [clip.id], additive: e.shiftKey });
    }
    dispatch({ type: "CHECKPOINT" });
    drag.current = {
      mode,
      startX: e.clientX,
      orig: mode === "trim-end" ? clipEnd(clip) : clip.start,
      candidates: makeCandidates(clip.id),
    };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const deltaSec = (e.clientX - d.startX) / pps;
    const raw = d.orig + deltaSec;
    const snapped = snapValue(raw, d.candidates, pps, snapping);
    if (d.mode === "move") dispatch({ type: "MOVE_CLIP", clipId: clip.id, start: snapped });
    else if (d.mode === "trim-start")
      dispatch({ type: "TRIM_CLIP", clipId: clip.id, edge: "start", value: snapped });
    else dispatch({ type: "TRIM_CLIP", clipId: clip.id, edge: "end", value: snapped });
  };

  const end = (e: React.PointerEvent) => {
    drag.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      onPointerDown={begin("move")}
      onPointerMove={move}
      onPointerUp={end}
      title={`${clip.label ?? clip.type} · ${clip.duration.toFixed(1)}s`}
      className={cn(
        "group absolute top-1 bottom-1 flex flex-col justify-between overflow-hidden rounded-md border px-2 py-1 text-left transition-shadow",
        selected ? "ring-2 ring-accent ring-offset-1 ring-offset-surface-2" : ""
      )}
      style={{
        left: clip.start * pps,
        width: Math.max(8, clip.duration * pps),
        backgroundColor: `${color}26`,
        borderColor: color,
        cursor: "grab",
      }}
    >
      {/* trim handles */}
      <span
        onPointerDown={begin("trim-start")}
        onPointerMove={move}
        onPointerUp={end}
        className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/40"
      />
      <span
        onPointerDown={begin("trim-end")}
        onPointerMove={move}
        onPointerUp={end}
        className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/40"
      />
      <span className="truncate text-[11px] font-semibold" style={{ color }}>
        {clip.label ?? clip.type}
      </span>
      <span className="truncate text-[10px] text-muted">{clip.duration.toFixed(1)}s</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zoom region block
// ---------------------------------------------------------------------------

interface ZoomBlockProps {
  region: ZoomRegion;
  pps: number;
  snapping: boolean;
  selected: boolean;
  makeCandidates: (excludeId?: string) => number[];
  dispatch: React.Dispatch<EditorAction>;
}

function ZoomBlock({ region, pps, snapping, selected, makeCandidates, dispatch }: ZoomBlockProps) {
  const drag = useRef<{
    mode: "move" | "start" | "end";
    startX: number;
    origStart: number;
    origEnd: number;
    candidates: number[];
  } | null>(null);

  const begin = (mode: "move" | "start" | "end") => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dispatch({ type: "SELECT_ZOOM", id: region.id });
    dispatch({ type: "CHECKPOINT" });
    drag.current = {
      mode,
      startX: e.clientX,
      origStart: region.start,
      origEnd: region.end,
      candidates: makeCandidates(),
    };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const deltaSec = (e.clientX - d.startX) / pps;
    if (d.mode === "move") {
      const len = d.origEnd - d.origStart;
      const start = snapValue(Math.max(0, d.origStart + deltaSec), d.candidates, pps, snapping);
      dispatch({ type: "UPDATE_ZOOM", id: region.id, patch: { start, end: start + len } });
    } else if (d.mode === "start") {
      const start = snapValue(d.origStart + deltaSec, d.candidates, pps, snapping);
      dispatch({ type: "UPDATE_ZOOM", id: region.id, patch: { start } });
    } else {
      const end = snapValue(d.origEnd + deltaSec, d.candidates, pps, snapping);
      dispatch({ type: "UPDATE_ZOOM", id: region.id, patch: { end } });
    }
  };

  const finish = (e: React.PointerEvent) => {
    drag.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      onPointerDown={begin("move")}
      onPointerMove={move}
      onPointerUp={finish}
      title={`Zoom ${region.scale.toFixed(2)}× · ${region.start.toFixed(1)}–${region.end.toFixed(1)}s`}
      className={cn(
        "absolute top-1 bottom-1 flex items-center justify-center gap-1 rounded border text-[10px] font-semibold",
        selected ? "ring-2 ring-accent" : ""
      )}
      style={{
        left: region.start * pps,
        width: Math.max(10, (region.end - region.start) * pps),
        backgroundColor: "#a78bfa33",
        borderColor: "#a78bfa",
        color: "#c4b5fd",
        cursor: "grab",
      }}
    >
      <span
        onPointerDown={begin("start")}
        onPointerMove={move}
        onPointerUp={finish}
        className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-white/40"
      />
      <ZoomIn size={11} /> {region.scale.toFixed(1)}×
      <span
        onPointerDown={begin("end")}
        onPointerMove={move}
        onPointerUp={finish}
        className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-white/40"
      />
      {selected && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: "DELETE_ZOOM", id: region.id });
          }}
          className="absolute -top-5 right-0 rounded bg-surface-3 p-0.5 text-danger"
          title="Delete zoom region"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}
