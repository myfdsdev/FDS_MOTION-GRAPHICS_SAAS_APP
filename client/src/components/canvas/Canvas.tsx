import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import type { AspectRatio, SceneElement } from "@/types";
import { snapValue } from "@/lib/editor/editorStore";
import type { EditorAction } from "@/lib/editor/editorStore";
import { SNAP_THRESHOLD_PX } from "@/lib/editor/editorTypes";

interface CanvasProps {
  elements: SceneElement[];
  selectedIds: string[];
  aspectRatio: AspectRatio;
  brandColors: string[];
  /** The current scene clip id element actions target. */
  clipId: string | null;
  snapping: boolean;
  dispatch: React.Dispatch<EditorAction>;
}

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];
const MIN_FRAC = 0.02;

const ASPECT_CLASS: Record<AspectRatio, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
};

function LucideGlyph({ name, color }: { name: string; color?: string }) {
  const lib = LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number | string; color?: string; strokeWidth?: number; style?: React.CSSProperties }>>;
  const Ico = lib[name] ?? lib.Sparkles;
  return <Ico size="100%" color={color ?? "currentColor"} strokeWidth={1.75} style={{ width: "100%", height: "100%" }} />;
}

export function Canvas({
  elements,
  selectedIds,
  aspectRatio,
  brandColors,
  clipId,
  snapping,
  dispatch,
}: CanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  // Track stage pixel size for fraction <-> px conversion.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toFrac = (clientX: number, clientY: number) => {
    const rect = stageRef.current!.getBoundingClientRect();
    return { fx: (clientX - rect.left) / rect.width, fy: (clientY - rect.top) / rect.height };
  };

  const ordered = [...elements].sort((a, b) => a.z - b.z);
  const single = selectedIds.length === 1 ? elements.find((e) => e.id === selectedIds[0]) ?? null : null;

  // ---- Drag to move ----
  const drag = useRef<{ id: string; startfx: number; startfy: number; ox: number; oy: number; dup: boolean } | null>(null);

  const beginMove = (el: SceneElement) => (e: React.PointerEvent) => {
    if (editingId) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dispatch({ type: "SELECT_ELEMENTS", ids: [el.id], additive: e.shiftKey });
    if (!clipId) return;
    dispatch({ type: "CHECKPOINT" });
    drag.current = { id: el.id, startfx: 0, startfy: 0, ox: el.x, oy: el.y, dup: e.altKey };
    const { fx, fy } = toFrac(e.clientX, e.clientY);
    drag.current.startfx = fx;
    drag.current.startfy = fy;
    if (e.altKey) {
      // Leave a copy behind; continue dragging the original.
      const { id: _id, ...rest } = el;
      dispatch({ type: "ADD_ELEMENT", clipId, elementType: el.type, element: rest as Partial<SceneElement> });
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !clipId) return;
    const { fx, fy } = toFrac(e.clientX, e.clientY);
    const el = elements.find((x) => x.id === d.id);
    if (!el) return;
    let nx = d.ox + (fx - d.startfx);
    let ny = d.oy + (fy - d.startfy);
    if (snapping) {
      const others = elements.filter((o) => o.id !== d.id);
      const xs = [0, 0.5, 1, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
      const ys = [0, 0.5, 1, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
      const rx = snapAnchored(nx, el.w, xs, size.w);
      const ry = snapAnchored(ny, el.h, ys, size.h);
      nx = rx.pos;
      ny = ry.pos;
      setGuides({ x: rx.guide, y: ry.guide });
    }
    dispatch({ type: "MOVE_ELEMENT", clipId, elementId: d.id, x: nx, y: ny });
  };

  const endMove = (e: React.PointerEvent) => {
    drag.current = null;
    setGuides({ x: null, y: null });
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  // ---- Resize ----
  const resize = useRef<{ id: string; handle: Handle; o: { x: number; y: number; w: number; h: number }; startfx: number; startfy: number } | null>(null);

  const beginResize = (el: SceneElement, handle: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    if (!clipId) return;
    dispatch({ type: "CHECKPOINT" });
    const { fx, fy } = toFrac(e.clientX, e.clientY);
    resize.current = { id: el.id, handle, o: { x: el.x, y: el.y, w: el.w, h: el.h }, startfx: fx, startfy: fy };
  };

  const onResizeMove = (e: React.PointerEvent) => {
    const r = resize.current;
    if (!r || !clipId) return;
    const { fx, fy } = toFrac(e.clientX, e.clientY);
    let dx = fx - r.startfx;
    let dy = fy - r.startfy;
    let { x, y, w, h } = r.o;
    const hasE = r.handle.includes("e");
    const hasW = r.handle.includes("w");
    const hasS = r.handle.includes("s");
    const hasN = r.handle.includes("n");

    if (e.shiftKey && r.handle.length === 2 && r.o.h > 0) {
      // Constrain proportions on corner handles: derive height delta from width.
      const aspect = r.o.w / r.o.h;
      const dw = hasE ? dx : -dx; // positive grows width
      const dh = dw / aspect; // positive grows height
      dy = hasS ? dh : -dh;
    }

    if (hasE) w = Math.max(MIN_FRAC, r.o.w + dx);
    if (hasW) { w = Math.max(MIN_FRAC, r.o.w - dx); x = r.o.x + (r.o.w - w); }
    if (hasS) h = Math.max(MIN_FRAC, r.o.h + dy);
    if (hasN) { h = Math.max(MIN_FRAC, r.o.h - dy); y = r.o.y + (r.o.h - h); }

    dispatch({ type: "RESIZE_ELEMENT", clipId, elementId: r.id, patch: { x, y, w, h } });
  };

  const endResize = (e: React.PointerEvent) => {
    resize.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  // ---- Rotation ----
  const rotate = useRef<{ id: string; cx: number; cy: number } | null>(null);
  const beginRotate = (el: SceneElement) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    if (!clipId) return;
    dispatch({ type: "CHECKPOINT" });
    const rect = stageRef.current!.getBoundingClientRect();
    rotate.current = {
      id: el.id,
      cx: rect.left + (el.x + el.w / 2) * rect.width,
      cy: rect.top + (el.y + el.h / 2) * rect.height,
    };
  };
  const onRotateMove = (e: React.PointerEvent) => {
    const r = rotate.current;
    if (!r || !clipId) return;
    let deg = (Math.atan2(e.clientY - r.cy, e.clientX - r.cx) * 180) / Math.PI + 90;
    if (e.shiftKey) deg = Math.round(deg / 15) * 15;
    dispatch({ type: "RESIZE_ELEMENT", clipId, elementId: r.id, patch: { rotation: Math.round(deg) } });
  };
  const endRotate = (e: React.PointerEvent) => {
    rotate.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  // ---- Marquee on empty stage ----
  const marqueeRef = useRef(false);
  const onStagePointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    dispatch({ type: "SELECT_ELEMENTS", ids: [] });
    marqueeRef.current = true;
    const { fx, fy } = toFrac(e.clientX, e.clientY);
    setMarquee({ x1: fx, y1: fy, x2: fx, y2: fy });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onStagePointerMove = (e: React.PointerEvent) => {
    if (!marqueeRef.current) return;
    const { fx, fy } = toFrac(e.clientX, e.clientY);
    setMarquee((m) => (m ? { ...m, x2: fx, y2: fy } : m));
  };
  const onStagePointerUp = () => {
    if (marqueeRef.current && marquee) {
      const l = Math.min(marquee.x1, marquee.x2);
      const r = Math.max(marquee.x1, marquee.x2);
      const t = Math.min(marquee.y1, marquee.y2);
      const b = Math.max(marquee.y1, marquee.y2);
      const hit = elements
        .filter((el) => el.x + el.w >= l && el.x <= r && el.y + el.h >= t && el.y <= b)
        .map((el) => el.id);
      if (hit.length) dispatch({ type: "SELECT_ELEMENTS", ids: hit });
    }
    marqueeRef.current = false;
    setMarquee(null);
  };

  // Commit inline text edit.
  const commitText = (el: SceneElement, value: string) => {
    if (clipId && value !== (el as { text?: string }).text) {
      dispatch({ type: "UPDATE_ELEMENT", clipId, elementId: el.id, patch: { text: value } });
    }
    setEditingId(null);
  };

  return (
    <div
      ref={stageRef}
      onPointerDown={onStagePointerDown}
      onPointerMove={(e) => {
        onMove(e);
        onResizeMove(e);
        onRotateMove(e);
        onStagePointerMove(e);
      }}
      onPointerUp={(e) => {
        endMove(e);
        endResize(e);
        endRotate(e);
        onStagePointerUp();
      }}
      className={`relative w-full max-w-4xl overflow-hidden rounded-lg shadow-2xl ${ASPECT_CLASS[aspectRatio]}`}
      style={{
        background: `radial-gradient(circle at 50% 40%, ${brandColors[1] ?? "#8b5cf6"}22, transparent 60%), linear-gradient(160deg, ${brandColors[0] ?? "#0f172a"}, #050509)`,
      }}
    >
      {ordered.map((el) => {
        const selected = selectedIds.includes(el.id);
        const editing = editingId === el.id;
        return (
          <div
            key={el.id}
            onPointerDown={beginMove(el)}
            onDoubleClick={() => el.type === "text" && setEditingId(el.id)}
            style={{
              position: "absolute",
              left: `${el.x * 100}%`,
              top: `${el.y * 100}%`,
              width: `${el.w * 100}%`,
              height: `${el.h * 100}%`,
              transform: `rotate(${el.rotation}deg)`,
              transformOrigin: "center",
              cursor: editing ? "text" : "grab",
              outline: selected ? "1.5px solid #a78bfa" : "none",
              outlineOffset: 2,
            }}
          >
            <ElementBody el={el} stageH={size.h} editing={editing} onCommit={commitText} />
            {selected && single && single.id === el.id && !editing && (
              <>
                {HANDLES.map((handle) => (
                  <span
                    key={handle}
                    onPointerDown={beginResize(el, handle)}
                    className="absolute z-10 h-2.5 w-2.5 rounded-sm border border-accent bg-bg"
                    style={handleStyle(handle)}
                  />
                ))}
                <span
                  onPointerDown={beginRotate(el)}
                  className="absolute left-1/2 z-10 h-3 w-3 -translate-x-1/2 cursor-grab rounded-full border border-accent bg-bg"
                  style={{ top: -26 }}
                />
              </>
            )}
          </div>
        );
      })}

      {marquee && (
        <div
          className="pointer-events-none absolute z-20 rounded border border-accent bg-accent/10"
          style={{
            left: `${Math.min(marquee.x1, marquee.x2) * 100}%`,
            top: `${Math.min(marquee.y1, marquee.y2) * 100}%`,
            width: `${Math.abs(marquee.x2 - marquee.x1) * 100}%`,
            height: `${Math.abs(marquee.y2 - marquee.y1) * 100}%`,
          }}
        />
      )}
    </div>
  );
}

function ElementBody({
  el,
  stageH,
  editing,
  onCommit,
}: {
  el: SceneElement;
  stageH: number;
  editing: boolean;
  onCommit: (el: SceneElement, value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      // Place caret at end.
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  if (el.type === "text") {
    const fontSize = (el.size ?? 0.08) * stageH;
    return (
      <div
        ref={ref}
        contentEditable={editing}
        suppressContentEditableWarning
        onBlur={(e) => onCommit(el, e.currentTarget.textContent ?? "")}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
          if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
        }}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center",
          textAlign: el.align ?? "center",
          fontSize,
          fontWeight: el.weight ?? 700,
          color: el.color ?? "#ffffff",
          fontFamily: el.font ?? "Inter, system-ui, sans-serif",
          lineHeight: el.lineHeight ?? 1.05,
          outline: "none",
          overflow: "hidden",
          cursor: editing ? "text" : "inherit",
        }}
      >
        {el.text}
      </div>
    );
  }

  if (el.type === "icon") {
    return (
      <div style={{ width: "100%", height: "100%", color: el.color ?? "#ffffff" }}>
        <LucideGlyph name={el.name} color={el.color} />
      </div>
    );
  }

  if (el.type === "image") {
    return el.src ? (
      <img src={el.src} alt="" style={{ width: "100%", height: "100%", objectFit: el.fit ?? "cover" }} draggable={false} />
    ) : (
      <div className="flex h-full w-full items-center justify-center rounded bg-surface-2/40 text-[10px] text-faint">
        image
      </div>
    );
  }

  // shape
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: el.fill ?? "#8b5cf6",
        border: el.stroke ? `${el.strokeWidth ?? 2}px solid ${el.stroke}` : "none",
        borderRadius: el.shape === "ellipse" ? "50%" : (el.radius ?? 8),
      }}
    />
  );
}

function handleStyle(handle: Handle): React.CSSProperties {
  const at: Record<Handle, React.CSSProperties> = {
    nw: { left: -5, top: -5, cursor: "nwse-resize" },
    n: { left: "50%", top: -5, transform: "translateX(-50%)", cursor: "ns-resize" },
    ne: { right: -5, top: -5, cursor: "nesw-resize" },
    e: { right: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" },
    se: { right: -5, bottom: -5, cursor: "nwse-resize" },
    s: { left: "50%", bottom: -5, transform: "translateX(-50%)", cursor: "ns-resize" },
    sw: { left: -5, bottom: -5, cursor: "nesw-resize" },
    w: { left: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" },
  };
  return at[handle];
}

// Snap an element's left/center/right anchor (axis-generic) to candidates.
// Returns the snapped position and the guide line (in fractions) it locked to.
function snapAnchored(
  pos: number,
  sizeFrac: number,
  candidates: number[],
  stagePx: number
): { pos: number; guide: number | null } {
  const anchors = [pos, pos + sizeFrac / 2, pos + sizeFrac];
  let bestDelta = 0;
  let bestGuide: number | null = null;
  let bestDist = SNAP_THRESHOLD_PX / Math.max(1, stagePx);
  for (const a of anchors) {
    const snapped = snapValue(a, candidates, stagePx, true);
    const delta = snapped - a;
    if (Math.abs(delta) < bestDist) {
      bestDist = Math.abs(delta);
      bestDelta = delta;
      bestGuide = snapped;
    }
  }
  return { pos: pos + bestDelta, guide: bestGuide };
}
