import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  type CalculateMetadataFunction,
} from "remotion";

import {
  HeroTitle,
  SectionTitle,
  TextCard,
  StatCard,
  StatReveal,
  CalloutBox,
  ComparisonCard,
  ProgressBar,
  CaptionOverlay,
  ParticleOverlay,
  ProviderChip,
  BarChart,
  LineChart,
  PieChart,
  KPIGrid,
} from "../components";

/* ------------------------------------------------------------------ *
 * SceneRenderer
 *
 * The single data-driven composition. The LLM emits a `videoPlan` JSON
 * object (validated against scene_plan.schema before it reaches here),
 * the worker resolves every generated asset to a real file/URL, and this
 * component turns the plan into a finished video:
 *
 *   - Each scene is one <Sequence> placed end-to-end on the timeline.
 *     Laying them in order IS the merge. There is no ffmpeg concat.
 *   - Within a scene, layers stack bottom -> top:
 *       1. background video (OffthreadVideo)  <- AI model output
 *       2. grade / tone overlay
 *       3. motion-graphics overlays           <- your existing components
 *       4. (captions + audio are global, see below)
 *   - Narration and music are two global <Audio> tracks. Music is ducked.
 *
 * FPS is fixed at 30 to match Root.jsx.
 * ------------------------------------------------------------------ */

const FPS = 30;

/* ---------- asset resolution (mirrors AnimeScene/CinematicRenderer) -- */
function resolveAsset(src: string): string {
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:")
  ) {
    return src;
  }
  const clean = src.replace(/^file:\/\/\/?/, "");
  if (clean.startsWith("/") || /^[A-Za-z]:[/\\]/.test(clean)) {
    return `file:///${clean.replace(/\\/g, "/")}`;
  }
  return staticFile(clean);
}

/* ---------- prop types: the contract this component renders ---------- */

export type OverlayType =
  | "heroTitle"
  | "sectionTitle"
  | "textCard"
  | "statCard"
  | "statReveal"
  | "calloutBox"
  | "comparisonCard"
  | "progressBar"
  | "providerChip"
  | "barChart"
  | "lineChart"
  | "pieChart"
  | "kpiGrid"
  | "particles";

export interface Overlay {
  /** which motion-graphics component to render on top of the footage */
  type: OverlayType;
  /** props passed straight through to that component */
  props: Record<string, unknown>;
  /** local frame offset inside the scene (default 0) */
  fromFrames?: number;
  /** how long the overlay stays up, in frames (default: rest of scene) */
  durationInFrames?: number;
}

export interface Background {
  /** "video" = AI model clip; "image" = still; "color" = flat fill */
  kind: "video" | "image" | "color";
  /** file path, URL, or staticFile name for video/image */
  src?: string;
  /** flat color when kind === "color" (also used as fallback) */
  color?: string;
  /** trim the source clip (seconds) */
  trimBeforeSeconds?: number;
  trimAfterSeconds?: number;
  /** css filter string for grading, e.g. "contrast(1.06) saturate(0.9)" */
  filter?: string;
  /** dark gradient wash 0..1 on top of the footage for text legibility */
  scrim?: number;
}

export interface Scene {
  id: string;
  /** scene length in seconds (converted to frames here) */
  durationSeconds: number;
  background: Background;
  overlays?: Overlay[];
  /** cross-fade the whole scene in/out, in frames */
  fadeInFrames?: number;
  fadeOutFrames?: number;
}

export interface AudioTrack {
  src: string;
  volume?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  trimBeforeSeconds?: number;
  trimAfterSeconds?: number;
}

export interface WordCaption {
  word: string;
  startMs: number;
  endMs: number;
}

export interface VideoPlan {
  scenes: Scene[];
  /** spoken narration (full track) */
  narration?: AudioTrack;
  /** music bed (separate, ducked) */
  music?: AudioTrack;
  /** word-level captions spanning the whole video */
  captions?: {
    words: WordCaption[];
    wordsPerPage?: number;
  };
}

export interface SceneRendererProps {
  [key: string]: unknown;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3";
  plan: VideoPlan;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNonNegativeFrames(value: unknown, fallback: number): number {
  return Math.max(0, Math.round(toFiniteNumber(value, fallback)));
}

function toPositiveFrames(value: unknown, fallback: number): number {
  return Math.max(1, Math.round(toFiniteNumber(value, fallback)));
}

function sceneDurationSeconds(scene: Scene): number {
  const legacyDuration = (scene as { durationSec?: unknown }).durationSec;
  return Math.max(
    0.1,
    toFiniteNumber(scene.durationSeconds, toFiniteNumber(legacyDuration, 3)),
  );
}

/* ---------- overlay dispatch: JSON type -> real component ------------ */

const OVERLAY_COMPONENTS: Record<OverlayType, React.ComponentType<any>> = {
  heroTitle: HeroTitle,
  sectionTitle: SectionTitle,
  textCard: TextCard,
  statCard: StatCard,
  statReveal: StatReveal,
  calloutBox: CalloutBox,
  comparisonCard: ComparisonCard,
  progressBar: ProgressBar,
  providerChip: ProviderChip,
  barChart: BarChart,
  lineChart: LineChart,
  pieChart: PieChart,
  kpiGrid: KPIGrid,
  particles: ParticleOverlay,
};

const OverlayLayer: React.FC<{ overlay: Overlay; sceneFrames: number }> = ({
  overlay,
  sceneFrames,
}) => {
  const Comp = OVERLAY_COMPONENTS[overlay.type];
  if (!Comp) return null;
  const from = toNonNegativeFrames(overlay.fromFrames, 0);
  const duration =
    overlay.durationInFrames !== undefined
      ? toPositiveFrames(overlay.durationInFrames, 1)
      : Math.max(1, sceneFrames - from);
  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <Comp {...overlay.props} />
      </AbsoluteFill>
    </Sequence>
  );
};

/* ---------- one scene: background + grade + overlays ----------------- */

const SceneLayer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const safeDurationInFrames = toPositiveFrames(
    durationInFrames,
    sceneDurationSeconds(scene) * fps,
  );

  const fadeIn = toNonNegativeFrames(scene.fadeInFrames, 8);
  const fadeOut = toNonNegativeFrames(scene.fadeOutFrames, 8);
  const fadeOutStart = Math.max(0, safeDurationInFrames - Math.max(1, fadeOut));
  const opacity = Math.min(
    fadeIn === 0
      ? 1
      : interpolate(frame, [0, fadeIn], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
    fadeOut === 0
      ? 1
      : interpolate(frame, [fadeOutStart, safeDurationInFrames], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
  );

  const bg = scene.background;
  const trimBefore =
    bg.trimBeforeSeconds !== undefined
      ? Math.round(bg.trimBeforeSeconds * fps)
      : undefined;
  const trimAfter =
    bg.trimAfterSeconds !== undefined
      ? Math.round(bg.trimAfterSeconds * fps)
      : undefined;

  // slow push-in keeps even a static clip feeling alive
  const scale = interpolate(frame, [0, safeDurationInFrames], [1.02, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: bg.color ?? "#000", opacity }}>
      {/* Layer 1: background footage */}
      {bg.kind === "video" && bg.src ? (
        <OffthreadVideo
          muted
          src={resolveAsset(bg.src)}
          trimBefore={trimBefore}
          trimAfter={trimAfter}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
            filter: bg.filter ?? "none",
          }}
        />
      ) : null}
      {bg.kind === "image" && bg.src ? (
        <img
          src={resolveAsset(bg.src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
            filter: bg.filter ?? "none",
          }}
        />
      ) : null}

      {/* Layer 2: grade / scrim for legibility */}
      {bg.scrim && bg.scrim > 0 ? (
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,${
              bg.scrim * 0.35
            }) 0%, rgba(0,0,0,${bg.scrim}) 100%)`,
          }}
        />
      ) : null}

      {/* Layer 3: motion-graphics overlays */}
      {(scene.overlays ?? []).map((overlay, i) => (
        <OverlayLayer
          key={`${overlay.type}-${i}`}
          overlay={overlay}
          sceneFrames={safeDurationInFrames}
        />
      ))}
    </AbsoluteFill>
  );
};

/* ---------- audio track with fades ----------------------------------- */

const AudioLayer: React.FC<{ track: AudioTrack; defaultVolume: number }> = ({
  track,
  defaultVolume,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const safeDurationInFrames = toPositiveFrames(durationInFrames, FPS);
  const volume = track.volume ?? defaultVolume;
  const fadeInFrames = Math.max(1, Math.round((track.fadeInSeconds ?? 0.3) * fps));
  const fadeOutFrames = Math.max(1, Math.round((track.fadeOutSeconds ?? 0.5) * fps));

  const trimBefore =
    track.trimBeforeSeconds !== undefined
      ? Math.round(track.trimBeforeSeconds * fps)
      : undefined;
  const trimAfter =
    track.trimAfterSeconds !== undefined
      ? Math.round(track.trimAfterSeconds * fps)
      : undefined;

  const v = Math.min(
    interpolate(frame, [0, fadeInFrames], [0, volume], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    interpolate(
      frame,
      [safeDurationInFrames - fadeOutFrames, safeDurationInFrames],
      [volume, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ),
  );

  return (
    <Audio
      src={resolveAsset(track.src)}
      trimBefore={trimBefore}
      trimAfter={trimAfter}
      volume={() => Math.max(0, v)}
    />
  );
};

/* ---------- the composition ------------------------------------------ */

export const SceneRenderer: React.FC<SceneRendererProps> = ({ plan }) => {
  let cursor = 0; // running frame offset = the merge
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Audio (spans whole video) */}
      {plan.narration ? (
        <AudioLayer track={plan.narration} defaultVolume={1} />
      ) : null}
      {plan.music ? (
        <AudioLayer track={plan.music} defaultVolume={0.15} />
      ) : null}

      {/* Scenes laid end-to-end */}
      {plan.scenes.map((scene) => {
        const dur = toPositiveFrames(sceneDurationSeconds(scene) * FPS, FPS);
        const from = cursor;
        cursor += dur;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={dur}>
            <SceneLayer scene={scene} />
          </Sequence>
        );
      })}

      {/* Captions (global, on top of everything) */}
      {plan.captions?.words?.length ? (
        <CaptionOverlay
          words={plan.captions.words}
          wordsPerPage={plan.captions.wordsPerPage ?? 5}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/* ---------- duration = sum of scenes (the auto-merge math) ----------- */

const DIMENSIONS: Record<string, [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:3": [1440, 1080],
};

export const calculateSceneMetadata: CalculateMetadataFunction<
  SceneRendererProps
> = async ({ props }) => {
  const totalSeconds = (props.plan?.scenes ?? []).reduce(
    (sum, s) => sum + sceneDurationSeconds(s),
    0,
  );
  const [width, height] = DIMENSIONS[props.aspectRatio ?? "16:9"] ?? DIMENSIONS["16:9"];
  return {
    durationInFrames: Math.max(1, Math.ceil(totalSeconds * FPS)),
    fps: FPS,
    width,
    height,
  };
};

export default SceneRenderer;
