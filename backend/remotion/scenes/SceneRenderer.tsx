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
  KineticTitle,
  LogoReveal,
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
  | "kineticTitle"
  | "logoReveal"
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

// Convert a seconds value to an integer frame count for trimBefore/trimAfter.
// Returns undefined for missing/zero/negative values — Remotion rejects
// trimAfter=0 ("must be a positive number"), and trimBefore=0 is a no-op, so in
// both cases we OMIT the prop rather than pass an invalid 0.
function trimFrames(seconds: unknown, fps: number): number | undefined {
  const n = typeof seconds === "number" ? seconds : Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const frames = Math.round(n * fps);
  return frames >= 1 ? frames : undefined;
}

function sceneDurationSeconds(scene: Scene): number {
  const legacyDuration = (scene as { durationSec?: unknown }).durationSec;
  return Math.max(
    0.1,
    toFiniteNumber(scene.durationSeconds, toFiniteNumber(legacyDuration, 3)),
  );
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textOf(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberOf(value: unknown, fallback: number): number {
  return toFiniteNumber(value, fallback);
}

function stringArrayOf(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === "string" && item.trim());
    if (items.length) return items;
  }
  if (typeof value === "string" && value.trim()) return [value];
  return fallback;
}

function chartDataOf(value: unknown) {
  const fallback = [
    { label: "Reach", value: 42 },
    { label: "Orders", value: 68 },
    { label: "Growth", value: 91 },
  ];
  if (!Array.isArray(value) || !value.length) return fallback;
  return value
    .map((item, index) => {
      const row = recordOf(item);
      return {
        label: textOf(row.label, `Item ${index + 1}`),
        value: numberOf(row.value, fallback[index % fallback.length].value),
        color: typeof row.color === "string" ? row.color : undefined,
      };
    })
    .filter((item) => Number.isFinite(item.value));
}

function lineSeriesOf(value: unknown) {
  const fallback = [
    {
      label: "Momentum",
      data: [
        { x: 0, y: 18 },
        { x: 1, y: 44 },
        { x: 2, y: 76 },
        { x: 3, y: 96 },
      ],
    },
  ];
  if (!Array.isArray(value) || !value.length) return fallback;
  const series = value
    .map((item, index) => {
      const row = recordOf(item);
      const data = Array.isArray(row.data)
        ? row.data.map((point, pointIndex) => {
            const p = recordOf(point);
            return {
              x: numberOf(p.x, pointIndex),
              y: numberOf(p.y, (pointIndex + 1) * 20),
            };
          })
        : [];
      return {
        label: textOf(row.label, `Series ${index + 1}`),
        data: data.length >= 2 ? data : fallback[0].data,
        color: typeof row.color === "string" ? row.color : undefined,
      };
    });
  return series.length ? series : fallback;
}

function metricsOf(value: unknown) {
  const fallback = [
    { label: "Speed", value: 2, suffix: "x" },
    { label: "Saves", value: 35, suffix: "%" },
    { label: "Ready", value: 24, suffix: "/7" },
  ];
  if (!Array.isArray(value) || !value.length) return fallback;
  return value.map((item, index) => {
    const row = recordOf(item);
    return {
      label: textOf(row.label, fallback[index % fallback.length].label),
      value: numberOf(row.value, fallback[index % fallback.length].value),
      prefix: typeof row.prefix === "string" ? row.prefix : undefined,
      suffix: typeof row.suffix === "string" ? row.suffix : undefined,
      change: row.change == null ? undefined : numberOf(row.change, 0),
      icon: typeof row.icon === "string" ? row.icon : undefined,
    };
  });
}

function normalizeOverlayProps(type: OverlayType, rawProps: unknown): Record<string, unknown> {
  const props = recordOf(rawProps);
  const title = textOf(props.title, textOf(props.text, "Key moment"));

  switch (type) {
    case "heroTitle":
      return { ...props, title, subtitle: props.subtitle };
    case "kineticTitle":
      return {
        ...props,
        title,
        subtitle: props.subtitle,
        gradient: Array.isArray(props.gradient) ? props.gradient : undefined,
        bg: typeof props.bg === "string" ? props.bg : undefined,
        accent: typeof props.accent === "string" ? props.accent : undefined,
      };
    case "logoReveal":
      return {
        ...props,
        brand: typeof props.brand === "string" ? props.brand : undefined,
        tagline: typeof props.tagline === "string" ? props.tagline : undefined,
        cta: typeof props.cta === "string" ? props.cta : undefined,
        gradient: Array.isArray(props.gradient) ? props.gradient : undefined,
        bg: typeof props.bg === "string" ? props.bg : undefined,
        accent: typeof props.accent === "string" ? props.accent : undefined,
      };
    case "sectionTitle":
      return { ...props, title, subtitle: props.subtitle };
    case "textCard":
      return { ...props, text: textOf(props.text, title) };
    case "statCard":
      return { ...props, stat: textOf(props.stat, textOf(props.value, "Fast")), subtitle: props.subtitle };
    case "statReveal":
      return { ...props, stat: textOf(props.stat, textOf(props.value, "Fast")), label: props.label };
    case "calloutBox":
      return { ...props, text: textOf(props.text, title) };
    case "comparisonCard":
      return {
        ...props,
        leftLabel: textOf(props.leftLabel, "Before"),
        rightLabel: textOf(props.rightLabel, "After"),
        leftValue: textOf(props.leftValue, "Slow"),
        rightValue: textOf(props.rightValue, "Fast"),
      };
    case "progressBar":
      return { ...props, progress: Math.max(0, Math.min(100, numberOf(props.progress, 72))) };
    case "providerChip":
      return { ...props, providers: stringArrayOf(props.providers, ["Kie", "Remotion", "AI video"]) };
    case "barChart":
    case "pieChart":
      return { ...props, data: chartDataOf(props.data), title: props.title };
    case "lineChart":
      return { ...props, series: lineSeriesOf(props.series), title: props.title };
    case "kpiGrid":
      return { ...props, metrics: metricsOf(props.metrics), title: props.title };
    case "particles":
      return { ...props, type: textOf(props.type, "sparkles") };
    default:
      return props;
  }
}

/* ---------- overlay dispatch: JSON type -> real component ------------ */

const OVERLAY_COMPONENTS: Record<OverlayType, React.ComponentType<any>> = {
  heroTitle: HeroTitle,
  kineticTitle: KineticTitle,
  logoReveal: LogoReveal,
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
  const props = normalizeOverlayProps(overlay.type, overlay.props);
  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <Comp {...props} />
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
  const trimBefore = trimFrames(bg.trimBeforeSeconds, fps);
  const trimAfter = trimFrames(bg.trimAfterSeconds, fps);

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

  const trimBefore = trimFrames(track.trimBeforeSeconds, fps);
  const trimAfter = trimFrames(track.trimAfterSeconds, fps);

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
