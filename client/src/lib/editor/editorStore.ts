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
  // Lottie attached to a templated scene is hoisted into a draggable element
  // positioned where SplitLottieText draws its panel. The template's LottiePanel
  // is suppressed (ensureElements strips lottieAsset/lottieAnimationData on the
  // cloned scene) so nothing is rendered twice.
  const lottieEl: SceneElement | null =
    scene.lottieAsset || scene.lottieAnimationData
      ? {
          id: uid("el"),
          type: "lottie",
          x: 0.08,
          y: 0.22,
          w: 0.34,
          h: 0.56,
          rotation: 0,
          z: 0,
          assetId: scene.lottieAsset,
          animationData: scene.lottieAnimationData as Record<string, unknown> | undefined,
          loop: true,
          speed: 1,
        }
      : null;

  // Templated scenes draw their own headline/subtext as the BASE layer, so the
  // foreground starts empty (apart from the hoisted lottie). Only legacy scenes
  // WITHOUT a template fall back to converting their text into elements.
  if (scene.sceneTemplate) return lottieEl ? [lottieEl] : [];

  const out: SceneElement[] = lottieEl ? [lottieEl] : [];
  let z = lottieEl ? 1 : 0;
  const headline = scene.headline || scene.text;
  if (headline) {
    out.push({
      id: uid("el"),
      type: "text",
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

/** Ensure a scene has an `elements` array (migrate legacy scenes lazily).
 *  Any Lottie attached to the scene is hoisted into an editable element AND
 *  removed from the cloned scene so the template's LottiePanel renders nothing
 *  (avoids drawing the same Lottie twice). The top-level sceneJson.scenes is
 *  untouched — this only affects the timeline clip's scene copy. */
export function ensureElements(scene: Scene): Scene {
  if (scene.elements && scene.elements.length) return scene;
  const elements = elementsFromScene(scene);
  const hadLottie = elements.some((e) => e.type === "lottie");
  if (!hadLottie) return { ...scene, elements };
  const { lottieAsset: _a, lottieAnimationData: _d, ...rest } = scene;
  void _a;
  void _d;
  return { ...rest, elements };
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
  const base = { id: uid("el"), x: 0.35, y: 0.4, w: 0.3, h: 0.2, rotation: 0, z: 0 };
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
    return {
      tracks: existing.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => ({
          ...c,
          scene: c.scene ? ensureElements(c.scene) : c.scene,
        })),
      })),
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
  | { type: "UPDATE_CLIP"; clipId: string; patch: Partial<TimelineClip> }
  // scene elements (canvas). clipId is the current scene clip (derived from playhead)
  | { type: "ADD_ELEMENT"; clipId: string; elementType: SceneElement["type"]; element?: Partial<SceneElement> }
  | { type: "UPDATE_ELEMENT"; clipId: string; elementId: string; patch: ElementPatch }
  | { type: "MOVE_ELEMENT"; clipId: string; elementId: string; x: number; y: number } // ephemeral
  | { type: "RESIZE_ELEMENT"; clipId: string; elementId: string; patch: ElementPatch } // ephemeral
  | { type: "DELETE_ELEMENT"; clipId: string; elementIds?: string[] }
  | { type: "REORDER_Z"; clipId: string; elementId: string; dir: "front" | "back" | "forward" | "backward" }
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
      return withHistory({
        ...state,
        tracks: mapElements(state.tracks, action.clipId, (els) =>
          els.map((e) => (e.id === action.elementId ? applyElementPatch(e, action.patch) : e))
        ),
      });
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
