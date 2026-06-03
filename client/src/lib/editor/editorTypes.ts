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

// ---------------------------------------------------------------------------
// Direct-manipulation scene elements (positions are FRACTIONS of the
// composition 0..1 so they survive resolution changes).
// ---------------------------------------------------------------------------

export type ElementType =
  | "text"
  | "icon"
  | "image"
  | "shape"
  | "lottie"
  | "subtitle"
  | "bar-chart";
export type TextAlign = "left" | "center" | "right";

export interface ElementBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation in degrees. */
  rotation: number;
  /** Stacking order; higher renders on top. */
  z: number;
}

export interface TextElement extends ElementBase {
  type: "text";
  text: string;
  font?: string;
  /** Font size as a fraction of composition HEIGHT (e.g. 0.08). */
  size?: number;
  weight?: number;
  color?: string;
  align?: TextAlign;
  lineHeight?: number;
}

export interface IconElement extends ElementBase {
  type: "icon";
  /** lucide-react icon name, e.g. "Sparkles". */
  name: string;
  color?: string;
}

export interface ImageElement extends ElementBase {
  type: "image";
  src: string;
  fit?: "cover" | "contain";
}

export interface ShapeElement extends ElementBase {
  type: "shape";
  shape: "rect" | "ellipse";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Corner radius in px (rect only). */
  radius?: number;
}

export interface LottieElement extends ElementBase {
  type: "lottie";
  /** Lottie library asset id; the editor / renderer resolves animationData. */
  assetId?: string;
  /** Inline animation JSON (preferred over assetId when present). */
  animationData?: Record<string, unknown>;
  /** 1 = normal speed. */
  speed?: number;
  loop?: boolean;
}

export interface SubtitleWordTiming {
  word: string;
  /** Seconds, relative to the subtitle's own start. */
  start: number;
  end: number;
}

export interface SubtitleElement extends ElementBase {
  type: "subtitle";
  /** The full narration string. Words split on whitespace. */
  text: string;
  font?: string;
  /** Font size as a fraction of composition HEIGHT. */
  size?: number;
  weight?: number;
  /** Color for past (already-spoken) words. Defaults to white. */
  color?: string;
  /** Color of the word currently being spoken. Defaults to the brand accent. */
  accent?: string;
  /** Opacity 0..1 for future (not-yet-spoken) words. Defaults to 0.45. */
  futureOpacity?: number;
  /** Total spoken duration (seconds). If omitted, the renderer uses the
   *  parent scene clip's duration. */
  duration?: number;
  /** Optional forced-alignment data (seconds relative to subtitle start).
   *  When absent the renderer falls back to character-weighted even split. */
  wordTimings?: SubtitleWordTiming[];
}

export interface BarChartRow {
  label: string;
  /** 0..axisMax (defaults to 100). */
  value: number;
}

export interface BarChartElement extends ElementBase {
  type: "bar-chart";
  title?: string;
  subtitle?: string;
  rows: BarChartRow[];
  /** Card background color (defaults to a warm cream). */
  bg?: string;
  /** Text color for title / labels / axis. */
  fg?: string;
  /** Bar fill color. */
  bar?: string;
  /** Top of the scale, default 100. */
  axisMax?: number;
  /** Show 0%..100% axis at the bottom. Default true. */
  showAxis?: boolean;
  /** Show the numeric value to the right of each bar. Default true. */
  showValues?: boolean;
  /** Appended to each value, e.g. "%". Default "%". */
  valueSuffix?: string;
  titleFont?: string;
  labelFont?: string;
  /** Total intro-animation duration in seconds. Default 2.4s. */
  animationDuration?: number;
  /** Delay before the intro animation starts, seconds. Default 0. */
  startDelay?: number;
}

export type SceneElement =
  | TextElement
  | IconElement
  | ImageElement
  | ShapeElement
  | LottieElement
  | SubtitleElement
  | BarChartElement;

/** Defaults for newly created elements (centered, sensible size per type). */
export const DEFAULT_TEXT_SIZE = 0.08;
export const DEFAULT_ELEMENT_COLOR = "#ffffff";

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
  /** Skip rendering this track's clips in the renderer when true. */
  muted?: boolean;
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
  /** Selected element ids on the canvas (within the current scene). */
  selectedElementIds: string[];
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
