import type { AnimationType, Scene, TransitionType } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Frames per second the renderer uses (must match backend/remotion/Root.jsx). */
export const FPS = 30;

/** Default timeline zoom in pixels per second of footage. */
export const DEFAULT_PX_PER_SECOND = 64;
export const MIN_PX_PER_SECOND = 12;
export const MAX_PX_PER_SECOND = 320;

/** How close (in px) a dragged edge must be to a candidate to snap. */
export const SNAP_THRESHOLD_PX = 8;

/** Shortest a clip / zoom region may be trimmed to, in seconds. */
export const MIN_CLIP_DURATION = 0.2;
export const MIN_ZOOM_DURATION = 0.3;

/** Hard cap on a single project's total length (seconds) — keeps validation sane. */
export const MAX_TIMELINE_DURATION = 600;

/** Lane heights (px). */
export const TRACK_HEIGHT = 56;
export const ZOOM_TRACK_HEIGHT = 36;
export const RULER_HEIGHT = 22;

export type ClipType = "scene" | "text" | "image" | "audio";
export type TrackKind = "scene" | "overlay" | "audio";

/** Per-clip-type accent used on the timeline + chips. */
export const CLIP_COLORS: Record<ClipType, string> = {
  scene: "#8b5cf6",
  text: "#38bdf8",
  image: "#34d399",
  audio: "#fbbf24",
};

// ---------------------------------------------------------------------------
// Persisted timeline model (also lives on VideoPlan.timeline)
// ---------------------------------------------------------------------------

/** A cinematic zoom applied to the whole frame between `start` and `end` (seconds). */
export interface ZoomRegion {
  id: string;
  start: number;
  end: number;
  /** Target scale at the peak of the region, e.g. 1.4. */
  scale: number;
  /** Focal point, 0..1 across the frame. Defaults to centre. */
  x?: number;
  y?: number;
}

export interface TimelineClip {
  id: string;
  type: ClipType;
  /** Position on its track, in seconds. */
  start: number;
  /** Length on the track, in seconds. */
  duration: number;
  /** Source in-point for trimmable media (audio), in seconds. */
  trimStart?: number;
  /** Audio gain, 0..1. */
  volume?: number;
  /** Entrance animation override. */
  animation?: AnimationType;
  transition?: TransitionType;
  /** type === "scene": the full scene payload (reuses the existing contract). */
  scene?: Scene;
  /** type === "text": overlay copy. */
  text?: string;
  /** type === "image" | "audio": media URL. */
  src?: string;
  /** Optional human label shown on the clip. */
  label?: string;
}

export interface TimelineTrack {
  id: string;
  kind: TrackKind;
  name?: string;
  clips: TimelineClip[];
}

export interface Timeline {
  fps: number;
  /** Total length in seconds (== max clip end). */
  duration: number;
  tracks: TimelineTrack[];
  zoomRegions: ZoomRegion[];
}

// ---------------------------------------------------------------------------
// Editor runtime state (not persisted)
// ---------------------------------------------------------------------------

export interface EditorSnapshot {
  tracks: TimelineTrack[];
  zoomRegions: ZoomRegion[];
  /** Selected clip ids. */
  selection: string[];
  /** Selected zoom-region id, if any. */
  selectedZoomId: string | null;
}

export interface EditorState extends EditorSnapshot {
  pxPerSecond: number;
  snapping: boolean;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
}

// ---------------------------------------------------------------------------
// ID helper
// ---------------------------------------------------------------------------

let _seq = 0;
export function uid(prefix = "id"): string {
  _seq += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${_seq.toString(36)}${rand}`;
}
