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

import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

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
import {
  DEFAULT_THEME,
  mixHex,
  normalizeTheme,
  resolveSceneTheme,
  withAlpha,
  type SceneTheme,
  type Theme,
} from "../components/theme";
import { DISPLAY_FONT } from "../components/fonts";

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

// Cross-scene transitions. Kept short so they read as polish, not delay. The
// last scene is padded by the total overlap so the composition stays exactly
// `sum(scene durations)` long (keeps audio/captions in sync, no black tail).
const TRANSITION_FRAMES = 12;
const TRANSITIONS = [
  fade(),
  slide({ direction: "from-right" }),
  wipe({ direction: "from-left" }),
  slide({ direction: "from-bottom" }),
];

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
  /** per-video design palette ({ bg, fg, accent, accent2 }, all hex) */
  theme?: Partial<Theme>;
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

function normalizeOverlayProps(
  type: OverlayType,
  rawProps: unknown,
  theme: SceneTheme,
  soloOverlay: boolean,
): Record<string, unknown> {
  const props = recordOf(rawProps);
  const title = textOf(props.title, textOf(props.text, "Key moment"));

  switch (type) {
    case "heroTitle":
      return { ...props, theme, title, subtitle: props.subtitle };
    case "kineticTitle":
      return {
        ...props,
        title,
        subtitle: props.subtitle,
        // Full-bleed premium scene: default its self-painted backdrop and
        // gradient to the video theme so it matches the rest of the video.
        gradient: Array.isArray(props.gradient)
          ? props.gradient
          : [theme.accent, theme.accent2],
        bg: typeof props.bg === "string" ? props.bg : mixHex(theme.bg, "#000000", 0.55),
        accent: typeof props.accent === "string" ? props.accent : theme.accent,
      };
    case "logoReveal":
      return {
        ...props,
        brand: typeof props.brand === "string" ? props.brand : undefined,
        tagline: typeof props.tagline === "string" ? props.tagline : undefined,
        cta: typeof props.cta === "string" ? props.cta : undefined,
        gradient: Array.isArray(props.gradient)
          ? props.gradient
          : [theme.accent, theme.accent2],
        bg: typeof props.bg === "string" ? props.bg : mixHex(theme.bg, "#000000", 0.55),
        accent: typeof props.accent === "string" ? props.accent : theme.accent,
      };
    case "sectionTitle":
      // Center stage only when it's the scene's ONLY overlay; otherwise anchor
      // top-left as a label so it never collides with a centered centerpiece
      // (statReveal, chart, textCard...).
      return {
        ...props,
        theme,
        title,
        subtitle: props.subtitle,
        position: props.position ?? (soloOverlay ? "center" : "top-left"),
      };
    case "textCard":
      return { ...props, theme, text: textOf(props.text, title) };
    case "statCard":
      return { ...props, theme, stat: textOf(props.stat, textOf(props.value, "Fast")), subtitle: props.subtitle };
    case "statReveal":
      return { ...props, theme, stat: textOf(props.stat, textOf(props.value, "Fast")), label: props.label };
    case "calloutBox":
      return { ...props, theme, text: textOf(props.text, title) };
    case "comparisonCard":
      return {
        // themed defaults: "before" in a neutral tone, "after" in the accent
        backgroundColor: "transparent",
        cardBackgroundColor: theme.panel,
        textColor: theme.fg,
        fontFamily: DISPLAY_FONT,
        leftColor: mixHex(theme.fg, theme.bg, 0.45),
        rightColor: theme.accent,
        ...props,
        leftLabel: textOf(props.leftLabel, "Before"),
        rightLabel: textOf(props.rightLabel, "After"),
        leftValue: textOf(props.leftValue, "Slow"),
        rightValue: textOf(props.rightValue, "Fast"),
      };
    case "progressBar":
      return {
        backgroundColor: "transparent",
        color: theme.accent,
        trackColor: withAlpha(theme.fg, 0.15),
        textColor: theme.fg,
        fontFamily: DISPLAY_FONT,
        ...props,
        progress: Math.max(0, Math.min(100, numberOf(props.progress, 72))),
      };
    case "providerChip":
      return {
        accentColor: theme.accent,
        ...props,
        providers: stringArrayOf(props.providers, ["Kie", "Remotion", "AI video"]),
      };
    case "barChart":
    case "pieChart":
    case "lineChart":
    case "kpiGrid": {
      // Theme the charts: transparent over the scene (they used to paint a
      // full white card), text in the scene fg, series colors from the accent
      // ramp. Explicit planner props still win.
      const chartTheme = {
        backgroundColor: "transparent",
        cardBackgroundColor: theme.panel,
        textColor: theme.fg,
        gridColor: withAlpha(theme.fg, 0.16),
        fontFamily: DISPLAY_FONT,
        colors: [
          theme.accent,
          theme.accent2,
          mixHex(theme.accent, theme.accent2, 0.5),
          mixHex(theme.accent, theme.onLight ? "#000000" : "#FFFFFF", 0.35),
          mixHex(theme.accent2, theme.onLight ? "#000000" : "#FFFFFF", 0.35),
          mixHex(theme.accent, theme.onLight ? "#FFFFFF" : "#000000", 0.3),
        ],
      };
      if (type === "lineChart") {
        return { ...chartTheme, ...props, series: lineSeriesOf(props.series), title: props.title };
      }
      if (type === "kpiGrid") {
        return { ...chartTheme, ...props, metrics: metricsOf(props.metrics), title: props.title };
      }
      return { ...chartTheme, ...props, data: chartDataOf(props.data), title: props.title };
    }
    case "particles":
      return { color: theme.accent, ...props, type: textOf(props.type, "sparkles") };
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

const OverlayLayer: React.FC<{
  overlay: Overlay;
  sceneFrames: number;
  theme: SceneTheme;
  soloOverlay: boolean;
}> = ({ overlay, sceneFrames, theme, soloOverlay }) => {
  const Comp = OVERLAY_COMPONENTS[overlay.type];
  if (!Comp) return null;
  const from = toNonNegativeFrames(overlay.fromFrames, 0);
  const duration =
    overlay.durationInFrames !== undefined
      ? toPositiveFrames(overlay.durationInFrames, 1)
      : Math.max(1, sceneFrames - from);
  const props = normalizeOverlayProps(overlay.type, overlay.props, theme, soloOverlay);
  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <Comp {...props} />
      </AbsoluteFill>
    </Sequence>
  );
};

/* ---------- one scene: background + grade + overlays ----------------- */

// Full-bleed overlays paint the entire frame themselves; stacking a second one
// (or anything under it) is invisible or double-titled. Keep only the first.
const FULL_BLEED = new Set<OverlayType>(["kineticTitle", "logoReveal"]);

function overlaysFor(scene: Scene): Overlay[] {
  const overlays = scene.overlays ?? [];
  const fullBleed = overlays.find((o) => FULL_BLEED.has(o.type));
  return fullBleed ? [fullBleed] : overlays;
}

const SceneLayer: React.FC<{ scene: Scene; videoTheme: Theme }> = ({
  scene,
  videoTheme,
}) => {
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

  // Resolve the video theme against THIS scene's actual backdrop, so overlay
  // text is always readable (footage reads dark via scrim; flat colors are
  // measured for luminance).
  const hasFootage = (bg.kind === "video" || bg.kind === "image") && !!bg.src;
  const fillColor = bg.color ?? videoTheme.bg;
  const sceneTheme = resolveSceneTheme(
    videoTheme,
    hasFootage ? { kind: "footage" } : { kind: "color", color: fillColor },
  );

  // slow push-in keeps even a static clip feeling alive
  const scale = interpolate(frame, [0, safeDurationInFrames], [1.02, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: fillColor, opacity }}>
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
      {(() => {
        const overlays = overlaysFor(scene);
        // "particles" is ambient decoration, not content — a sectionTitle
        // paired only with particles still deserves center stage.
        const contentCount = overlays.filter((o) => o.type !== "particles").length;
        return overlays.map((overlay, i) => (
          <OverlayLayer
            key={`${overlay.type}-${i}`}
            overlay={overlay}
            sceneFrames={safeDurationInFrames}
            theme={sceneTheme}
            soloOverlay={contentCount <= 1}
          />
        ));
      })()}
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
  const scenes = plan.scenes ?? [];
  const videoTheme: Theme = plan.theme ? normalizeTheme(plan.theme) : DEFAULT_THEME;
  const n = scenes.length;
  const overlap = Math.max(0, n - 1) * TRANSITION_FRAMES;

  // Build a flat list of <Transition> + <Sequence> nodes for TransitionSeries.
  const nodes: React.ReactNode[] = [];
  scenes.forEach((scene, i) => {
    if (i > 0) {
      nodes.push(
        <TransitionSeries.Transition
          key={`t-${i}`}
          presentation={TRANSITIONS[(i - 1) % TRANSITIONS.length]}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />,
      );
    }
    const base = toPositiveFrames(sceneDurationSeconds(scene) * FPS, FPS);
    const dur = base + (i === n - 1 ? overlap : 0); // pad last to keep total length
    nodes.push(
      <TransitionSeries.Sequence key={scene.id} durationInFrames={dur}>
        <SceneLayer scene={scene} videoTheme={videoTheme} />
      </TransitionSeries.Sequence>,
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Audio (spans whole video) */}
      {plan.narration ? <AudioLayer track={plan.narration} defaultVolume={1} /> : null}
      {plan.music ? <AudioLayer track={plan.music} defaultVolume={0.15} /> : null}

      {/* Scenes with cross-transitions */}
      <TransitionSeries>{nodes}</TransitionSeries>

      {/* Captions (global, on top of everything) — the pill is always dark,
          so highlight in the raw theme accent (nudged bright if needed). */}
      {plan.captions?.words?.length ? (
        <CaptionOverlay
          words={plan.captions.words}
          wordsPerPage={plan.captions.wordsPerPage ?? 5}
          highlightColor={resolveSceneTheme(videoTheme, { kind: "footage" }).accent}
          fontFamily={DISPLAY_FONT}
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
