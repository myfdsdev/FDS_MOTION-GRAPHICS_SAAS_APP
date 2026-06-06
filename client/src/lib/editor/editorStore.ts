import type { Scene } from "@/types";
import {
  CLIP_COLORS,
  DEFAULT_ELEMENT_COLOR,
  DEFAULT_PX_PER_SECOND,
  DEFAULT_TEXT_SIZE,
  MAX_PX_PER_SECOND,
  MIN_CLIP_DURATION,
  MIN_PX_PER_SECOND,
  MIN_ZOOM_DURATION,
  SNAP_THRESHOLD_PX,
  uid,
  type ClipType,
  type EditorSnapshot,
  type EditorState,
  type SceneElement,
  type Timeline,
  type TimelineClip,
  type TimelineTrack,
  type TrackKind,
  type ZoomRegion,
} from "./editorTypes";

// ---------------------------------------------------------------------------
// Scene-element migration + helpers
// ---------------------------------------------------------------------------

/** Build canvas elements from a legacy scene's headline/text/subtext fields. */
export function elementsFromScene(scene: Scene): SceneElement[] {
  const out: SceneElement[] = [];
  let z = 0;
  const headline = scene.headline || scene.text;
  if (headline) {
    out.push({
      id: uid("el"),
      type: "text",
      name: "__headline__",
      x: 0.1,
      y: 0.38,
      w: 0.8,
      h: 0.18,
      rotation: 0,
      z: z++,
      text: headline,
      size: 0.1,
      weight: 800,
      color: DEFAULT_ELEMENT_COLOR,
      align: "center",
    });
  }
  if (scene.subtext) {
    out.push({
      id: uid("el"),
      type: "text",
      name: "__subtext__",
      x: 0.15,
      y: 0.58,
      w: 0.7,
      h: 0.12,
      rotation: 0,
      z: z++,
      text: scene.subtext,
      size: 0.04,
      weight: 500,
      color: "#cbd5e1",
      align: "center",
    });
  }
  return out;
}

/** Ensure a scene has an `elements` array with draggable text elements
 *  created from the scene's headline/subtext.
 *
 *  Template fields stay on the scene so the backend renderer still has them.
 *  The LivePreview strips headline/subtext before passing to the Remotion
 *  Player so the template renders visuals + animations but NOT text —
 *  the canvas overlay owns the text layer (draggable). */
export function ensureElements(scene: Scene): Scene {
  if (scene.elements && scene.elements.length) return scene;
  const elements = elementsFromScene(scene);
  return { ...scene, elements };
}

export function currentSceneClipId(
  tracks: TimelineTrack[],
  time: number
): string | null {
  const sceneTrack = tracks.find((t) => t.kind === "scene");
  if (!sceneTrack) return null;
  const clip =
    sceneTrack.clips.find((c) => time >= c.start && time < c.start + c.duration) ??
    sceneTrack.clips[sceneTrack.clips.length - 1];
  return clip?.id ?? null;
}

const NEW_ELEMENT_DEFAULTS = (type: SceneElement["type"]): SceneElement => {
  // Default every new element to a short fade-in. Users can change or remove
  // from the Properties → Animation section.
  const animation = { in: { kind: "fade" as const, at: 0, duration: 0.4 } };
  const base = {
    id: uid("el"),
    x: 0.35,
    y: 0.4,
    w: 0.3,
    h: 0.2,
    rotation: 0,
    z: 0,
    animation,
  };
  switch (type) {
    case "text":
      return { ...base, type: "text", text: "New text", size: DEFAULT_TEXT_SIZE, weight: 700, color: DEFAULT_ELEMENT_COLOR, align: "center" };
    case "icon":
      return { ...base, type: "icon", w: 0.16, h: 0.16, name: "Sparkles", color: DEFAULT_ELEMENT_COLOR };
    case "image":
      return { ...base, type: "image", src: "", fit: "cover" };
    case "shape":
      return { ...base, type: "shape", shape: "rect", fill: "#8b5cf6" };
    case "lottie":
      return { ...base, type: "lottie", w: 0.34, h: 0.56, loop: true, speed: 1 };
    case "bar-chart":
      // Default to a chart that fills most of the canvas and looks like the
      // reference image (cream card, dark serif title, orange bars).
      return {
        ...base,
        type: "bar-chart",
        x: 0.06,
        y: 0.08,
        w: 0.88,
        h: 0.84,
        title: "U.S Economy after the Great Depression",
        subtitle:
          "The chart below shows recovery statistics. Each line represents the official rate reported that month.",
        rows: [
          { label: "UNEMPLOYMENT", value: 85 },
          { label: "BANKS THAT FAILED", value: 43 },
          { label: "GROWTH OF GOVERNMENT SPENDING", value: 72 },
        ],
        bg: "#f5efe6",
        fg: "#2a1f17",
        bar: "#d97b1a",
        axisMax: 100,
        showAxis: true,
        showValues: true,
        valueSuffix: "%",
        titleFont: "Georgia",
        labelFont: "Inter",
        animationDuration: 2.4,
        startDelay: 0,
      };
    case "subtitle":
      // Subtitles default to a wide band along the lower third of the canvas.
      return {
        ...base,
        type: "subtitle",
        x: 0.08,
        y: 0.74,
        w: 0.84,
        h: 0.18,
        text: "Type your subtitle here and it will read along",
        size: 0.07,
        weight: 800,
        color: "#ffffff",
        // accent left undefined -> canvas/renderer fall back to brandColors[1]
        futureOpacity: 0.45,
      };
    case "line-chart":
      return {
        ...base,
        type: "line-chart",
        x: 0.55,
        y: 0.15,
        w: 0.38,
        h: 0.5,
        title: "Revenue",
        points: [
          { label: "Q1", value: 20 },
          { label: "Q2", value: 35 },
          { label: "Q3", value: 60 },
          { label: "Q4", value: 92 },
        ],
        finalValue: 92,
        finalLabel: "this quarter",
        valuePrefix: "$",
        valueSuffix: "K",
        line: "#34d399",
        showGrid: true,
        animationDuration: 1.6,
      };
    case "stat":
      return {
        ...base,
        type: "stat",
        x: 0.08,
        y: 0.35,
        w: 0.34,
        h: 0.3,
        value: 1240000,
        valuePrefix: "$",
        label: "ARR",
        caption: "as of last month",
        sparkline: [12, 18, 25, 30, 36, 42, 55, 70, 88, 100],
        accent: "#fbbf24",
        countUp: true,
        animationDuration: 1.2,
      };
  }
};

// ---------------------------------------------------------------------------
// Selectors / helpers
// ---------------------------------------------------------------------------

export function clipEnd(clip: TimelineClip): number {
  return clip.start + clip.duration;
}

export function totalDuration(state: Pick<EditorState, "tracks" | "zoomRegions">): number {
  let max = 0;
  for (const track of state.tracks) {
    for (const clip of track.clips) max = Math.max(max, clipEnd(clip));
  }
  for (const region of state.zoomRegions) max = Math.max(max, region.end);
  return Math.max(0.1, max);
}

export function findClip(
  tracks: TimelineTrack[],
  clipId: string
): { track: TimelineTrack; clip: TimelineClip } | null {
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

export function clipColor(type: ClipType): string {
  return CLIP_COLORS[type];
}

/**
 * Snap a candidate time to the nearest gravity point if within SNAP_THRESHOLD_PX.
 * `candidates` are times in seconds (clip edges, playhead, ruler ticks, 0).
 */
export function snapValue(
  value: number,
  candidates: number[],
  pxPerSecond: number,
  enabled: boolean
): number {
  if (!enabled) return value;
  const thresholdSec = SNAP_THRESHOLD_PX / pxPerSecond;
  let best = value;
  let bestDist = thresholdSec;
  for (const c of candidates) {
    const dist = Math.abs(c - value);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

/** All natural snap targets except the clip currently being dragged. */
export function snapCandidates(
  state: Pick<EditorState, "tracks" | "zoomRegions">,
  playhead: number,
  excludeClipId?: string
): number[] {
  const out: number[] = [0, playhead];
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      out.push(clip.start, clipEnd(clip));
    }
  }
  for (const region of state.zoomRegions) out.push(region.start, region.end);
  return out;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function sceneClip(scene: Scene, start: number): TimelineClip {
  const duration = Math.max(MIN_CLIP_DURATION, Number(scene.duration) || 4);
  return {
    id: uid("clip"),
    type: "scene",
    start,
    duration,
    scene: ensureElements(scene),
    animation: scene.animation,
    transition: scene.transition,
    label: scene.headline || scene.text,
  };
}

/** Build editor state from an existing scene list (sequential clips on one track).
 *  When `voiceover` is provided and no `existing` timeline exists, an audio
 *  track with a single clip is auto-appended so the narration shows on the
 *  timeline. If `existing` is provided, it wins (user-saved edits trump). */
export function createInitialState(
  scenes: Scene[],
  existing?: Timeline | null,
  voiceover?: { url: string; duration: number } | null
): EditorState {
  if (existing && existing.tracks?.length) {
    const tracks: TimelineTrack[] = existing.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => ({
        ...c,
        scene: c.scene ? ensureElements(c.scene) : c.scene,
      })),
    }));

    // Backfill narration on existing timelines that pre-dated voiceover: if a
    // voiceoverUrl is present and no clip references it, append the Narration
    // audio track so the renderer has audio to mux into the MP4.
    if (voiceover && voiceover.url && voiceover.duration > 0) {
      const alreadyHas = tracks.some((t) =>
        t.clips.some((c) => c.type === "audio" && c.src === voiceover.url)
      );
      if (!alreadyHas) {
        tracks.push({
          id: uid("track"),
          kind: "audio",
          name: "Narration",
          clips: [
            {
              id: uid("clip"),
              type: "audio",
              start: 0,
              duration: voiceover.duration,
              src: voiceover.url,
              volume: 1,
              label: "Narration",
            },
          ],
        });
      }
    }

    return {
      tracks,
      zoomRegions: (existing.zoomRegions ?? []).map((z) => ({ ...z })),
      selection: [],
      selectedZoomId: null,
      selectedElementIds: [],
      pxPerSecond: DEFAULT_PX_PER_SECOND,
      snapping: true,
      past: [],
      future: [],
    };
  }

  let cursor = 0;
  const clips: TimelineClip[] = [];
  for (const scene of scenes ?? []) {
    const clip = sceneClip(scene, cursor);
    clips.push(clip);
    cursor += clip.duration;
  }

  const sceneTrack: TimelineTrack = { id: uid("track"), kind: "scene", name: "Scenes", clips };
  const initialTracks: TimelineTrack[] = [sceneTrack];

  if (voiceover && voiceover.url && voiceover.duration > 0) {
    initialTracks.push({
      id: uid("track"),
      kind: "audio",
      name: "Narration",
      clips: [
        {
          id: uid("clip"),
          type: "audio",
          start: 0,
          duration: voiceover.duration,
          src: voiceover.url,
          volume: 1,
          label: "Narration",
        },
      ],
    });
  }

  return {
    tracks: initialTracks,
    zoomRegions: [],
    selection: [],
    selectedZoomId: null,
    selectedElementIds: [],
    pxPerSecond: DEFAULT_PX_PER_SECOND,
    snapping: true,
    past: [],
    future: [],
  };
}

/** Serialize editor state back to a persistable Timeline. */
export function toTimeline(state: EditorState, fps: number): Timeline {
  return {
    fps,
    duration: totalDuration(state),
    tracks: state.tracks.map((t) => ({
      ...t,
      clips: t.clips
        .slice()
        .sort((a, b) => a.start - b.start)
        .map((c) => ({ ...c })),
    })),
    zoomRegions: state.zoomRegions.slice().sort((a, b) => a.start - b.start),
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type EditorAction =
  // history checkpoint to call once at the start of a drag/trim gesture
  | { type: "CHECKPOINT" }
  // ephemeral (no history) — used during pointer drags after a CHECKPOINT
  | { type: "MOVE_CLIP"; clipId: string; start: number; trackId?: string }
  | { type: "TRIM_CLIP"; clipId: string; edge: "start" | "end"; value: number }
  | { type: "UPDATE_ZOOM"; id: string; patch: Partial<ZoomRegion> }
  // discrete (push history themselves)
  | { type: "SPLIT_AT"; time: number; clipId?: string }
  | { type: "DELETE_SELECTED" }
  | { type: "DUPLICATE_SELECTED" }
  | { type: "ADD_TRACK"; kind: TrackKind }
  | { type: "ADD_CLIP"; trackId: string; clip: Partial<TimelineClip> & { type: ClipType } }
  | { type: "ADD_ZOOM"; start: number; end: number }
  | { type: "DELETE_ZOOM"; id: string }
  | { type: "REORDER_TRACK"; trackId: string; toIndex: number }
  | { type: "UPDATE_TRACK"; trackId: string; patch: Partial<TimelineTrack> }
  | { type: "UPDATE_CLIP"; clipId: string; patch: Partial<TimelineClip> }
  // Scene-level edit on a scene clip (headline / text / subtext / template / …).
  // Touches `clip.scene` only — the clip's own timing/track stays untouched.
  | { type: "UPDATE_SCENE"; clipId: string; patch: Partial<Scene> }
  // scene elements (canvas). clipId is the current scene clip (derived from playhead)
  | { type: "ADD_ELEMENT"; clipId: string; elementType: SceneElement["type"]; element?: Partial<SceneElement> }
  | { type: "UPDATE_ELEMENT"; clipId: string; elementId: string; patch: ElementPatch }
  | { type: "MOVE_ELEMENT"; clipId: string; elementId: string; x: number; y: number } // ephemeral
  | { type: "RESIZE_ELEMENT"; clipId: string; elementId: string; patch: ElementPatch } // ephemeral
  | { type: "DELETE_ELEMENT"; clipId: string; elementIds?: string[] }
  | { type: "REORDER_Z"; clipId: string; elementId: string; dir: "front" | "back" | "forward" | "backward" }
  | { type: "SET_ELEMENT_ORDER"; clipId: string; orderedIds: string[] }
  | { type: "TOGGLE_ELEMENT_HIDDEN"; clipId: string; elementId: string }
  | { type: "TOGGLE_ELEMENT_LOCKED"; clipId: string; elementId: string }
  | { type: "RENAME_ELEMENT"; clipId: string; elementId: string; name: string }
  | { type: "SELECT_ELEMENTS"; ids: string[]; additive?: boolean }
  // selection / view (no history)
  | { type: "SELECT"; ids: string[]; additive?: boolean }
  | { type: "SELECT_ZOOM"; id: string | null }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_PX_PER_SECOND"; value: number }
  | { type: "TOGGLE_SNAP" }
  // history
  | { type: "UNDO" }
  | { type: "REDO" }
  // replace entire doc (e.g. after server reload)
  | { type: "RESET"; state: EditorState };

function snapshot(state: EditorState): EditorSnapshot {
  return {
    tracks: state.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => ({
        ...c,
        scene: c.scene
          ? { ...c.scene, elements: c.scene.elements ? c.scene.elements.map((e) => ({ ...e })) : undefined }
          : c.scene,
      })),
    })),
    zoomRegions: state.zoomRegions.map((z) => ({ ...z })),
    selection: [...state.selection],
    selectedZoomId: state.selectedZoomId,
    selectedElementIds: [...state.selectedElementIds],
  };
}

/** Push current state onto the undo stack and clear redo. */
function withHistory(state: EditorState): EditorState {
  return { ...state, past: [...state.past, snapshot(state)].slice(-100), future: [] };
}

function mapClip(
  tracks: TimelineTrack[],
  clipId: string,
  fn: (c: TimelineClip) => TimelineClip
): TimelineTrack[] {
  return tracks.map((t) => ({
    ...t,
    clips: t.clips.map((c) => (c.id === clipId ? fn(c) : c)),
  }));
}

// A patch can carry any element field; the discriminant `type` is never changed.
export type ElementPatch = Partial<Omit<SceneElement, "type">> & {
  text?: string;
  font?: string;
  size?: number;
  weight?: number;
  color?: string;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  // Rich-text styling
  italic?: boolean;
  underline?: boolean;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  bgColor?: string;
  bgRadius?: number;
  name?: string;
  src?: string;
  fit?: "cover" | "contain";
  shape?: "rect" | "ellipse";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  assetId?: string;
  animationData?: Record<string, unknown>;
  speed?: number;
  loop?: boolean;
  // Karaoke subtitle fields
  accent?: string;
  futureOpacity?: number;
  duration?: number;
  wordTimings?: { word: string; start: number; end: number }[];
  // Base extensions
  hidden?: boolean;
  locked?: boolean;
  opacity?: number;
  animation?: import("./editorTypes").ElementAnimation;
  // Bar-chart fields
  title?: string;
  subtitle?: string;
  rows?: { label: string; value: number }[];
  // Line-chart fields
  points?: { label?: string; value: number }[];
  line?: string;
  finalValue?: number;
  finalLabel?: string;
  valuePrefix?: string;
  showGrid?: boolean;
  // Stat fields
  value?: number;
  caption?: string;
  sparkline?: number[];
  countUp?: boolean;
  bg?: string;
  fg?: string;
  bar?: string;
  axisMax?: number;
  showAxis?: boolean;
  showValues?: boolean;
  valueSuffix?: string;
  titleFont?: string;
  labelFont?: string;
  animationDuration?: number;
  startDelay?: number;
};

/** Map over the elements of a specific scene clip. */
function mapElements(
  tracks: TimelineTrack[],
  clipId: string,
  fn: (elements: SceneElement[]) => SceneElement[]
): TimelineTrack[] {
  return mapClip(tracks, clipId, (c) => {
    if (!c.scene) return c;
    const elements = c.scene.elements ?? [];
    return { ...c, scene: { ...c.scene, elements: fn(elements) } };
  });
}

function applyElementPatch(el: SceneElement, patch: ElementPatch): SceneElement {
  return { ...el, ...patch } as SceneElement;
}

function reorderZ(
  elements: SceneElement[],
  elementId: string,
  dir: "front" | "back" | "forward" | "backward"
): SceneElement[] {
  const order = [...elements].sort((a, b) => a.z - b.z);
  const idx = order.findIndex((e) => e.id === elementId);
  if (idx === -1) return elements;
  const [moved] = order.splice(idx, 1);
  if (dir === "front") order.push(moved);
  else if (dir === "back") order.unshift(moved);
  else if (dir === "forward") order.splice(Math.min(order.length, idx + 1), 0, moved);
  else order.splice(Math.max(0, idx - 1), 0, moved);
  const zById = new Map(order.map((e, i) => [e.id, i]));
  return elements.map((e) => ({ ...e, z: zById.get(e.id) ?? e.z }));
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "CHECKPOINT":
      return withHistory(state);

    case "MOVE_CLIP": {
      let tracks = state.tracks;
      if (action.trackId) {
        // Move the clip to another track of compatible kind.
        const found = findClip(tracks, action.clipId);
        if (found && found.track.id !== action.trackId) {
          const dest = tracks.find((t) => t.id === action.trackId);
          if (dest && dest.kind === found.track.kind) {
            tracks = tracks.map((t) => {
              if (t.id === found.track.id)
                return { ...t, clips: t.clips.filter((c) => c.id !== action.clipId) };
              if (t.id === dest.id)
                return { ...t, clips: [...t.clips, { ...found.clip, start: Math.max(0, action.start) }] };
              return t;
            });
            return { ...state, tracks };
          }
        }
      }
      return {
        ...state,
        tracks: mapClip(tracks, action.clipId, (c) => ({
          ...c,
          start: Math.max(0, action.start),
        })),
      };
    }

    case "TRIM_CLIP": {
      return {
        ...state,
        tracks: mapClip(state.tracks, action.clipId, (c) => {
          if (action.edge === "start") {
            const maxStart = clipEnd(c) - MIN_CLIP_DURATION;
            const newStart = Math.min(Math.max(0, action.value), maxStart);
            const delta = newStart - c.start;
            return {
              ...c,
              start: newStart,
              duration: c.duration - delta,
              trimStart: (c.trimStart ?? 0) + delta,
            };
          }
          const newEnd = Math.max(c.start + MIN_CLIP_DURATION, action.value);
          return { ...c, duration: newEnd - c.start };
        }),
      };
    }

    case "UPDATE_ZOOM": {
      return {
        ...state,
        zoomRegions: state.zoomRegions.map((z) =>
          z.id === action.id
            ? normalizeZoom({ ...z, ...action.patch })
            : z
        ),
      };
    }

    case "UPDATE_CLIP": {
      return withHistory({
        ...state,
        tracks: mapClip(state.tracks, action.clipId, (c) => ({ ...c, ...action.patch })),
      });
    }

    case "UPDATE_SCENE": {
      return withHistory({
        ...state,
        tracks: mapClip(state.tracks, action.clipId, (c) => {
          if (!c.scene) return c;
          return { ...c, scene: { ...c.scene, ...action.patch } };
        }),
      });
    }

    case "UPDATE_TRACK": {
      return withHistory({
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.trackId ? { ...t, ...action.patch } : t
        ),
      });
    }

    // ---- Scene elements (canvas) ----

    case "ADD_ELEMENT": {
      const next = withHistory(state);
      const newEl = {
        ...NEW_ELEMENT_DEFAULTS(action.elementType),
        ...action.element,
        id: uid("el"),
        type: action.elementType,
      } as SceneElement;
      return {
        ...next,
        tracks: mapElements(next.tracks, action.clipId, (els) => {
          const maxZ = els.reduce((m, e) => Math.max(m, e.z), -1);
          return [...els, { ...newEl, z: maxZ + 1 }];
        }),
        selectedElementIds: [newEl.id],
      };
    }

    case "UPDATE_ELEMENT": {
      let tracks = mapElements(state.tracks, action.clipId, (els) =>
        els.map((e) => (e.id === action.elementId ? applyElementPatch(e, action.patch) : e))
      );
      // Sync headline/subtext canvas elements back to the scene fields so the
      // backend renderer uses the updated text in the final MP4.
      if (action.patch.text != null) {
        const found = findClip(state.tracks, action.clipId);
        const el = found?.clip.scene?.elements?.find((e) => e.id === action.elementId);
        if (el?.name === "__headline__") {
          tracks = mapClip(tracks, action.clipId, (c) =>
            c.scene ? { ...c, scene: { ...c.scene, headline: action.patch.text, text: action.patch.text } } : c
          );
        } else if (el?.name === "__subtext__") {
          tracks = mapClip(tracks, action.clipId, (c) =>
            c.scene ? { ...c, scene: { ...c.scene, subtext: action.patch.text } } : c
          );
        }
      }
      return withHistory({ ...state, tracks });
    }

    case "MOVE_ELEMENT": {
      return {
        ...state,
        tracks: mapElements(state.tracks, action.clipId, (els) =>
          els.map((e) => (e.id === action.elementId ? { ...e, x: action.x, y: action.y } : e))
        ),
      };
    }

    case "RESIZE_ELEMENT": {
      return {
        ...state,
        tracks: mapElements(state.tracks, action.clipId, (els) =>
          els.map((e) => (e.id === action.elementId ? applyElementPatch(e, action.patch) : e))
        ),
      };
    }

    case "DELETE_ELEMENT": {
      const ids = action.elementIds ?? state.selectedElementIds;
      if (!ids.length) return state;
      const next = withHistory(state);
      return {
        ...next,
        tracks: mapElements(next.tracks, action.clipId, (els) =>
          els.filter((e) => !ids.includes(e.id))
        ),
        selectedElementIds: [],
      };
    }

    case "REORDER_Z": {
      const next = withHistory(state);
      return {
        ...next,
        tracks: mapElements(next.tracks, action.clipId, (els) =>
          reorderZ(els, action.elementId, action.dir)
        ),
      };
    }

    case "SET_ELEMENT_ORDER": {
      const next = withHistory(state);
      return {
        ...next,
        tracks: mapElements(next.tracks, action.clipId, (els) => {
          // Layers panel top row = highest z. Map ordered list to z values.
          const byId = new Map(els.map((e) => [e.id, e]));
          const n = action.orderedIds.length;
          const remapped: SceneElement[] = [];
          action.orderedIds.forEach((id, i) => {
            const e = byId.get(id);
            if (e) remapped.push({ ...e, z: n - 1 - i });
          });
          // Append any element not in the ordered list at the back (shouldn't happen).
          for (const e of els) if (!action.orderedIds.includes(e.id)) remapped.push(e);
          return remapped;
        }),
      };
    }

    case "TOGGLE_ELEMENT_HIDDEN": {
      const next = withHistory(state);
      return {
        ...next,
        tracks: mapElements(next.tracks, action.clipId, (els) =>
          els.map((e) =>
            e.id === action.elementId ? { ...e, hidden: !e.hidden } : e
          )
        ),
      };
    }

    case "TOGGLE_ELEMENT_LOCKED": {
      const next = withHistory(state);
      return {
        ...next,
        tracks: mapElements(next.tracks, action.clipId, (els) =>
          els.map((e) =>
            e.id === action.elementId ? { ...e, locked: !e.locked } : e
          )
        ),
      };
    }

    case "RENAME_ELEMENT": {
      const next = withHistory(state);
      return {
        ...next,
        tracks: mapElements(next.tracks, action.clipId, (els) =>
          els.map((e) =>
            e.id === action.elementId ? { ...e, name: action.name } : e
          )
        ),
      };
    }

    case "SELECT_ELEMENTS":
      return {
        ...state,
        selectedElementIds: action.additive
          ? Array.from(new Set([...state.selectedElementIds, ...action.ids]))
          : action.ids,
        selection: [],
        selectedZoomId: null,
      };

    case "SPLIT_AT": {
      const targetIds = action.clipId
        ? [action.clipId]
        : state.selection.length
          ? state.selection
          : [];
      const next = withHistory(state);
      const newSelection: string[] = [];
      const tracks = next.tracks.map((track) => {
        const clips: TimelineClip[] = [];
        for (const clip of track.clips) {
          const within =
            action.time > clip.start + MIN_CLIP_DURATION &&
            action.time < clipEnd(clip) - MIN_CLIP_DURATION;
          const shouldSplit =
            within && (targetIds.length === 0 || targetIds.includes(clip.id));
          if (!shouldSplit) {
            clips.push(clip);
            continue;
          }
          const leftDur = action.time - clip.start;
          const left: TimelineClip = { ...clip, duration: leftDur };
          const right: TimelineClip = {
            ...clip,
            id: uid("clip"),
            start: action.time,
            duration: clip.duration - leftDur,
            trimStart: (clip.trimStart ?? 0) + leftDur,
          };
          clips.push(left, right);
          newSelection.push(right.id);
        }
        return { ...track, clips };
      });
      return { ...next, tracks, selection: newSelection.length ? newSelection : next.selection };
    }

    case "DELETE_SELECTED": {
      if (!state.selection.length && !state.selectedZoomId) return state;
      const next = withHistory(state);
      return {
        ...next,
        tracks: next.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => !state.selection.includes(c.id)),
        })),
        zoomRegions: state.selectedZoomId
          ? next.zoomRegions.filter((z) => z.id !== state.selectedZoomId)
          : next.zoomRegions,
        selection: [],
        selectedZoomId: null,
      };
    }

    case "DUPLICATE_SELECTED": {
      if (!state.selection.length) return state;
      const next = withHistory(state);
      const newIds: string[] = [];
      const tracks = next.tracks.map((track) => {
        const additions: TimelineClip[] = [];
        for (const clip of track.clips) {
          if (!state.selection.includes(clip.id)) continue;
          const copy: TimelineClip = {
            ...clip,
            id: uid("clip"),
            start: clipEnd(clip),
          };
          additions.push(copy);
          newIds.push(copy.id);
        }
        return additions.length ? { ...track, clips: [...track.clips, ...additions] } : track;
      });
      return { ...next, tracks, selection: newIds };
    }

    case "ADD_TRACK": {
      const next = withHistory(state);
      const count = next.tracks.filter((t) => t.kind === action.kind).length;
      const name =
        action.kind === "audio"
          ? `Audio ${count + 1}`
          : action.kind === "overlay"
            ? `Overlay ${count + 1}`
            : `Track ${count + 1}`;
      const track: TimelineTrack = { id: uid("track"), kind: action.kind, name, clips: [] };
      return { ...next, tracks: [...next.tracks, track] };
    }

    case "ADD_CLIP": {
      const next = withHistory(state);
      const clip: TimelineClip = {
        start: 0,
        duration: 3,
        ...action.clip,
        id: uid("clip"),
        type: action.clip.type,
      };
      return {
        ...next,
        tracks: next.tracks.map((t) =>
          t.id === action.trackId ? { ...t, clips: [...t.clips, clip] } : t
        ),
        selection: [clip.id],
      };
    }

    case "ADD_ZOOM": {
      const next = withHistory(state);
      const region = normalizeZoom({
        id: uid("zoom"),
        start: action.start,
        end: action.end,
        scale: 1.4,
        x: 0.5,
        y: 0.5,
      });
      return { ...next, zoomRegions: [...next.zoomRegions, region], selectedZoomId: region.id };
    }

    case "DELETE_ZOOM": {
      const next = withHistory(state);
      return {
        ...next,
        zoomRegions: next.zoomRegions.filter((z) => z.id !== action.id),
        selectedZoomId: state.selectedZoomId === action.id ? null : state.selectedZoomId,
      };
    }

    case "REORDER_TRACK": {
      const idx = state.tracks.findIndex((t) => t.id === action.trackId);
      if (idx === -1) return state;
      const next = withHistory(state);
      const tracks = [...next.tracks];
      const [moved] = tracks.splice(idx, 1);
      tracks.splice(Math.max(0, Math.min(tracks.length, action.toIndex)), 0, moved);
      return { ...next, tracks };
    }

    case "SELECT":
      return {
        ...state,
        selection: action.additive
          ? Array.from(new Set([...state.selection, ...action.ids]))
          : action.ids,
        selectedZoomId: null,
      };

    case "SELECT_ZOOM":
      return { ...state, selectedZoomId: action.id, selection: [] };

    case "CLEAR_SELECTION":
      return { ...state, selection: [], selectedZoomId: null, selectedElementIds: [] };

    case "SET_PX_PER_SECOND":
      return {
        ...state,
        pxPerSecond: Math.max(MIN_PX_PER_SECOND, Math.min(MAX_PX_PER_SECOND, action.value)),
      };

    case "TOGGLE_SNAP":
      return { ...state, snapping: !state.snapping };

    case "UNDO": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        ...previous,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, 100),
      };
    }

    case "REDO": {
      if (!state.future.length) return state;
      const nextSnap = state.future[0];
      return {
        ...state,
        ...nextSnap,
        past: [...state.past, snapshot(state)].slice(-100),
        future: state.future.slice(1),
      };
    }

    case "RESET":
      return action.state;

    default:
      return state;
  }
}

function normalizeZoom(z: ZoomRegion): ZoomRegion {
  let { start, end } = z;
  if (end < start) [start, end] = [end, start];
  if (end - start < MIN_ZOOM_DURATION) end = start + MIN_ZOOM_DURATION;
  return {
    ...z,
    start: Math.max(0, start),
    end: Math.max(start + MIN_ZOOM_DURATION, end),
    scale: Math.max(1, Math.min(4, z.scale || 1.4)),
    x: z.x == null ? 0.5 : Math.max(0, Math.min(1, z.x)),
    y: z.y == null ? 0.5 : Math.max(0, Math.min(1, z.y)),
  };
}

export const canUndo = (s: EditorState) => s.past.length > 0;
export const canRedo = (s: EditorState) => s.future.length > 0;
