import { Lottie } from "@remotion/lottie";
import * as LucideIcons from "lucide-react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Series,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getSceneStyle } from "./animations.js";
import { getLottieAsset } from "./lottieCatalog.js";
import { getElementMotion } from "./elementMotion.js";

const DEFAULT_COLORS = ["#0f172a", "#8b5cf6", "#38bdf8", "#34d399"];

const templateFallbacks = [
  "kinetic-title",
  "animated-bg-text",
  "app-showcase",
  "offer-burst",
  "proof-cards",
  "final-cta",
  "karaoke-subtitle",
];

// ---------------------------------------------------------------------------
// Deterministic per-scene layout variation. Same seed -> same result, so a
// re-render of the same scene looks identical, but each scene in a video gets
// a different layout/chrome/background so videos stop looking templated.
// ---------------------------------------------------------------------------

// Expanded structural vocabulary. Each new dimension multiplies the
// number of perceptibly distinct chrome looks the renderer can produce
// without changing palette/fonts. Old codes (radial-glow/diagonal/
// corner-spotlight, 0/72/96, left/center) are kept first in each list
// so existing seeds keep producing the same look.
const BG_VARIANTS = ["radial-glow", "diagonal", "corner-spotlight", "mesh", "noise"];
const CORNERS = ["tl", "tr", "bl", "br"];
const GRID_SIZES = [0, 56, 72, 96, 120];
const ALIGNS = ["left", "center", "right"];
const SIZE_SCALES = [0.90, 0.95, 1.0, 1.05, 1.1, 1.18];
// Density of accent chrome (badge bar, micro-rule under headline, ticker).
const CHROME_LEVELS = ["minimal", "balanced", "rich"];
// Layout split for templates that support it.
const LAYOUT_SPLITS = ["60/40", "50/50", "40/60", "70/30", "30/70"];
// Headline weight stack — visibly changes typography without swapping fonts.
const WEIGHT_STACKS = ["900/600", "800/500", "950/700", "850/450"];

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function pickSceneVariant(scene, index, structureSeed = 0) {
  // Mix the user/project structureSeed in so the same prompt re-generated
  // gives a different structure, and a power user's videos keep changing.
  const seed =
    hashStr(`${index}|${scene?.text || scene?.headline || ""}`) ^
    (Number(structureSeed) || 0);
  const bg = BG_VARIANTS[seed % BG_VARIANTS.length];
  const flip = ((seed >> 2) & 1) === 1;
  const accentCorner = CORNERS[(seed >> 4) % CORNERS.length];
  const numberCandidates = CORNERS.filter((c) => c !== accentCorner);
  const numberCorner = numberCandidates[(seed >> 6) % numberCandidates.length];
  const gridSize = GRID_SIZES[(seed >> 8) % GRID_SIZES.length];
  const align = ALIGNS[(seed >> 10) % ALIGNS.length];
  const sizeScale = SIZE_SCALES[(seed >> 12) % SIZE_SCALES.length];
  const chromeLevel = CHROME_LEVELS[(seed >> 14) % CHROME_LEVELS.length];
  const layoutSplit = LAYOUT_SPLITS[(seed >> 16) % LAYOUT_SPLITS.length];
  const weightStack = WEIGHT_STACKS[(seed >> 18) % WEIGHT_STACKS.length];
  // Sub-tweaks accumulate the "every video feels distinct" signal.
  const accentShapeIdx = (seed >> 20) % 4; // 0 bar · 1 dot · 2 triangle · 3 ring
  const motionIntensity = 0.7 + ((seed >> 22) % 7) * 0.1; // 0.7..1.3
  return {
    bg,
    flip,
    accentCorner,
    numberCorner,
    gridSize,
    align,
    sizeScale,
    chromeLevel,
    layoutSplit,
    weightStack,
    accentShapeIdx,
    motionIntensity,
  };
}

const CORNER_POS = {
  tl: { top: "10%", left: "8%" },
  tr: { top: "10%", right: "8%" },
  bl: { bottom: "10%", left: "8%" },
  br: { bottom: "10%", right: "8%" },
};

export const Video = ({ brandColors, scenes, timeline, structureSeed = 0 }) => {
  const { fps } = useVideoConfig();
  const colors = Array.isArray(brandColors) && brandColors.length ? brandColors : DEFAULT_COLORS;

  // New multi-track editor model takes precedence when present.
  if (timeline && Array.isArray(timeline.tracks) && timeline.tracks.length) {
    return <TimelineVideo timeline={timeline} colors={colors} />;
  }

  const list = Array.isArray(scenes) && scenes.length ? scenes : [];

  return (
    <AbsoluteFill style={{ backgroundColor: colors[0] }}>
      <Series>
        {list.map((scene, i) => (
          <Series.Sequence
            key={i}
            durationInFrames={Math.max(1, Math.round((Number(scene.duration) || 4) * fps))}
          >
            <Scene scene={scene} colors={colors} index={i} structureSeed={structureSeed} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Multi-track timeline renderer
// ---------------------------------------------------------------------------

// Frame helpers.  `fStart` is for non-negative offsets (Sequence `from`, audio
// `startFrom`) — must allow 0 so a clip at t=0 actually starts at frame 0.
// `fDur` is for `durationInFrames`, which Remotion requires to be ≥ 1.
const fStart = (seconds, fps) => Math.max(0, Math.round((Number(seconds) || 0) * fps));
const fDur = (seconds, fps) => Math.max(1, Math.round((Number(seconds) || 0) * fps));

function TimelineVideo({ timeline, colors }) {
  const { fps } = useVideoConfig();
  const tracks = Array.isArray(timeline.tracks) ? timeline.tracks : [];
  const zoomRegions = Array.isArray(timeline.zoomRegions) ? timeline.zoomRegions : [];

  // Visual tracks render bottom-up in array order; audio tracks are siblings
  // outside the zoom camera so the gain isn't affected by transforms.
  const visualTracks = tracks.filter((t) => t.kind !== "audio");
  const audioTracks = tracks.filter((t) => t.kind === "audio");

  return (
    <AbsoluteFill style={{ backgroundColor: colors[0] }}>
      <ZoomCamera zoomRegions={zoomRegions} fps={fps}>
        {visualTracks.map((track) =>
          (track.clips ?? []).map((clip, i) => (
            <Sequence
              key={clip.id ?? `${track.id}-${i}`}
              from={fStart(clip.start, fps)}
              durationInFrames={fDur(clip.duration, fps)}
              layout="none"
            >
              <TimelineClipView clip={clip} colors={colors} index={i} fps={fps} />
            </Sequence>
          ))
        )}
      </ZoomCamera>

      {audioTracks.map((track) =>
        track.muted
          ? null
          : (track.clips ?? [])
          .filter((clip) => clip.src)
          .map((clip, i) => (
            <Sequence
              key={clip.id ?? `${track.id}-a${i}`}
              from={fStart(clip.start, fps)}
              durationInFrames={fDur(clip.duration, fps)}
            >
              <Audio
                src={clip.src}
                startFrom={fStart(clip.trimStart ?? 0, fps)}
                volume={clip.volume == null ? 1 : clip.volume}
              />
            </Sequence>
          ))
      )}
    </AbsoluteFill>
  );
}

// Animate frame scale/translate between each zoom region's start and end.
function ZoomCamera({ zoomRegions, fps, children }) {
  const frame = useCurrentFrame();

  let scale = 1;
  let originX = 50;
  let originY = 50;

  for (const region of zoomRegions) {
    const start = fStart(region.start, fps);
    const end = fStart(region.end, fps);
    if (frame < start || frame > end) continue;
    const span = Math.max(1, end - start);
    const ramp = Math.min(span / 2, Math.round(span * 0.3));
    let p;
    if (frame < start + ramp) p = interpolate(frame, [start, start + ramp], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    else if (frame > end - ramp) p = interpolate(frame, [end - ramp, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    else p = 1;
    const target = Math.max(1, Math.min(4, Number(region.scale) || 1.4));
    scale = 1 + (target - 1) * p;
    originX = (region.x == null ? 0.5 : region.x) * 100;
    originY = (region.y == null ? 0.5 : region.y) * 100;
    break;
  }

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: `${originX}% ${originY}%`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function TimelineClipView({ clip, colors, index, fps }) {
  if (clip.type === "image" && clip.src) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        <Img src={clip.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    );
  }

  if (clip.type === "text") {
    return <TextOverlay text={clip.text || clip.label || ""} accent={colors[1] ?? DEFAULT_COLORS[1]} />;
  }

  // Default: a scene clip reuses the existing rich Scene renderer.
  const scene = clip.scene || { text: clip.label || "", animation: clip.animation || "fade-in" };
  return (
    <Scene
      scene={scene}
      colors={colors}
      index={index}
      clipDurationInFrames={fDur(clip.duration, fps)}
    />
  );
}

function TextOverlay({ text, accent }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "8%" }}>
      <div
        style={{
          opacity,
          fontSize: 72,
          fontWeight: 850,
          letterSpacing: "-0.03em",
          textAlign: "center",
          color: "#ffffff",
          textShadow: `0 8px 40px ${accent}66`,
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

const Scene = ({ scene, colors, index, clipDurationInFrames, structureSeed = 0 }) => {
  const frame = useCurrentFrame();
  const cfg = useVideoConfig();
  const { fps, width, height } = cfg;
  const durationInFrames = clipDurationInFrames ?? cfg.durationInFrames;
  const style = getSceneStyle(scene.animation, frame, fps, durationInFrames);
  const template = scene.sceneTemplate || templateFallbacks[index % templateFallbacks.length];

  const base = colors[0] ?? DEFAULT_COLORS[0];
  const accent = colors[(index % Math.max(1, colors.length - 1)) + 1] ?? colors[1] ?? DEFAULT_COLORS[1];
  const secondary = colors[(index + 2) % colors.length] ?? DEFAULT_COLORS[2];
  const variant = pickSceneVariant(scene, index, structureSeed);

  const common = {
    scene,
    colors,
    index,
    style,
    base,
    accent,
    secondary,
    width,
    height,
    variant,
  };

  const hasElements = Array.isArray(scene.elements) && scene.elements.length > 0;
  // Does the foreground elements layer carry the scene's title? If so, we
  // skip the template's own headline drawing so we don't render two titles
  // on top of each other (the bug the user spotted: AI-written copy + the
  // template's hardcoded fallback "Your idea in motion" both showing at once).
  const elementsCarryText =
    hasElements &&
    scene.elements.some(
      (el) =>
        (el.type === "text" || el.type === "subtitle") &&
        typeof el.text === "string" &&
        el.text.trim().length > 0
    );
  // Render the template only when there's a scene-level headline/subtext to
  // show, OR when there are no text-bearing elements about to draw a title.
  const { title, subtext } = sceneText(scene);
  const renderTemplate = (title || subtext) && !elementsCarryText;

  return (
    <AbsoluteFill style={sceneShell(base, accent, secondary, frame, durationInFrames, variant)}>
      <SceneChrome accent={accent} index={index} variant={variant} />
      <MotionBackdrop accent={accent} secondary={secondary} frame={frame} durationInFrames={durationInFrames} />

      {/* BASE layer — only drawn when the scene template actually owns the
          title. When the AI puts text in elements instead, we let the
          elements layer be the sole source of truth so nothing overlaps. */}
      {renderTemplate && template === "kinetic-title" && <KineticTitle {...common} />}
      {renderTemplate && template === "animated-bg-text" && <AnimatedBgText {...common} />}
      {renderTemplate && template === "app-showcase" && <AppShowcase {...common} />}
      {renderTemplate && template === "offer-burst" && <OfferBurst {...common} />}
      {renderTemplate && template === "proof-cards" && <ProofCards {...common} />}
      {renderTemplate && template === "final-cta" && <FinalCta {...common} />}
      {renderTemplate && template === "karaoke-subtitle" && (
        <KaraokeSubtitle {...common} durationInFrames={durationInFrames} />
      )}
      {renderTemplate && !templateFallbacks.includes(template) && <KineticTitle {...common} />}

      {/* FOREGROUND layer — user-placed elements render on top of the template. */}
      {hasElements && (
        <ElementsLayer
          elements={scene.elements}
          width={width}
          height={height}
          style={style}
          sceneTime={frame / fps}
          sceneDuration={durationInFrames / fps}
        />
      )}
    </AbsoluteFill>
  );
};

// Renders direct-manipulation elements at their fractional positions. Mirrors
// client/src/components/canvas/Canvas.tsx exactly so a drag in the editor lands
// in the same spot in the MP4.
function ElementsLayer({ elements, width, height, sceneTime, sceneDuration }) {
  const ordered = [...elements]
    .filter((e) => !e.hidden)
    .sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  return (
    <AbsoluteFill>
      {ordered.map((el) => {
        const motion = getElementMotion(el.animation, sceneTime, sceneDuration);
        const box = {
          position: "absolute",
          left: el.x * width,
          top: el.y * height,
          width: el.w * width,
          height: el.h * height,
          transform: `rotate(${el.rotation || 0}deg) ${motion.transform}`,
          transformOrigin: "center",
          opacity: motion.opacity,
        };
        return (
          <div key={el.id} style={box}>
            <ElementBody el={el} height={height} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function ElementBody({ el, height }) {
  if (el.type === "bar-chart") {
    return <BarChartElementBody el={el} height={height} />;
  }
  if (el.type === "line-chart") {
    return <LineChartElementBody el={el} height={height} />;
  }
  if (el.type === "stat") {
    return <StatElementBody el={el} height={height} />;
  }
  if (el.type === "subtitle") {
    return <SubtitleElementBody el={el} height={height} />;
  }
  if (el.type === "text") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent:
            el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center",
          textAlign: el.align || "center",
          fontSize: (el.size ?? 0.08) * height,
          fontWeight: el.weight || 700,
          color: el.color || "#ffffff",
          fontFamily: el.font || "Inter, system-ui, sans-serif",
          lineHeight: el.lineHeight || 1.05,
          overflow: "hidden",
          whiteSpace: "pre-wrap",
        }}
      >
        {el.text}
      </div>
    );
  }

  if (el.type === "icon") {
    const Ico = LucideIcons[el.name] || LucideIcons.Sparkles;
    return (
      <div style={{ width: "100%", height: "100%", color: el.color || "#ffffff" }}>
        <Ico style={{ width: "100%", height: "100%" }} strokeWidth={1.75} />
      </div>
    );
  }

  if (el.type === "image") {
    return el.src ? (
      <Img src={el.src} style={{ width: "100%", height: "100%", objectFit: el.fit || "cover" }} />
    ) : null;
  }

  if (el.type === "lottie") {
    if (!el.animationData) return null;
    return (
      <Lottie
        animationData={el.animationData}
        loop={el.loop !== false}
        playbackRate={el.speed || 1}
        style={{ width: "100%", height: "100%" }}
      />
    );
  }

  // shape
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: el.fill || "#8b5cf6",
        border: el.stroke ? `${el.strokeWidth ?? 2}px solid ${el.stroke}` : "none",
        borderRadius: el.shape === "ellipse" ? "50%" : (el.radius ?? 8),
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Animated bar-chart element — mirrors client SubtitleBody/BarChartBody so
// the editor preview matches the MP4 exactly. Uses the parent Sequence's
// local frame, which restarts at 0 for each scene clip.
// ---------------------------------------------------------------------------
function easeOutCubic(t) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

function computeBarChartProgressNode(el, sceneTime) {
  const total = el.animationDuration ?? 2.4;
  const delay = el.startDelay ?? 0;
  const t = Math.max(0, sceneTime - delay);

  const titleP = easeOutCubic(Math.min(1, t / (total * 0.15)));
  const subtitleP = easeOutCubic(
    Math.min(1, Math.max(0, t - total * 0.1) / (total * 0.18))
  );

  const rowsCount = (el.rows && el.rows.length) || 0;
  const barsStart = total * 0.3;
  const barsEnd = total * 0.95;
  const span = Math.max(0.0001, barsEnd - barsStart);
  const perRow = rowsCount > 0 ? span / (rowsCount + 1.2) : span;
  const rowsP = [];
  for (let i = 0; i < rowsCount; i++) {
    const rowStart = barsStart + i * (perRow * 0.55);
    const rowEnd = rowStart + perRow;
    const p = (t - rowStart) / Math.max(0.0001, rowEnd - rowStart);
    rowsP.push(easeOutCubic(Math.min(1, Math.max(0, p))));
  }

  const axisP = easeOutCubic(
    Math.min(1, Math.max(0, t - total * 0.55) / (total * 0.3))
  );

  return { titleP, subtitleP, axisP, rowsP };
}

// ---------------------------------------------------------------------------
// Growth / line chart. Draws an SVG polyline + filled area that progressively
// "draws itself" left-to-right (stroke-dasharray trick); a number badge at
// the end counts up to `finalValue` once the line reaches it. Perfect for
// "Revenue grew 4×" explainer scenes.
// ---------------------------------------------------------------------------
function LineChartElementBody({ el, height }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalDur = Math.max(0.4, Number(el.animationDuration) || 1.6);
  const seconds = frame / fps;
  const p = Math.max(0, Math.min(1, seconds / totalDur));
  const fontSize = (Number(el.size) || 0.05) * height;

  const points = Array.isArray(el.points) ? el.points : [];
  if (points.length < 2) {
    return <div style={{ width: "100%", height: "100%", color: "#f88" }}>line-chart needs ≥ 2 points</div>;
  }
  const values = points.map((pt) => Number(pt.value) || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  // Inner padding inside the card so axis labels never touch the edge.
  const PAD = 0.08;
  const xy = points.map((_, i) => {
    const x = PAD + (i / (points.length - 1)) * (1 - 2 * PAD);
    const y = PAD + (1 - (values[i] - min) / range) * (1 - 2 * PAD);
    return { x: x * 100, y: y * 100 };
  });
  const linePath = xy.reduce(
    (acc, pt, i) => acc + (i === 0 ? `M${pt.x},${pt.y}` : ` L${pt.x},${pt.y}`),
    ""
  );
  const areaPath =
    linePath +
    ` L${xy[xy.length - 1].x},${100 - PAD * 100}` +
    ` L${xy[0].x},${100 - PAD * 100} Z`;

  const lineColor = el.line || el.accent || "#34d399";
  const fillColor = el.fill || `${lineColor}33`;
  const bg = el.bg || "rgba(8, 10, 20, 0.55)";
  const fg = el.fg || "#ffffff";

  // Smooth count-up for the final value badge — starts at 65% of total dur.
  const animatedFinal =
    (Number(el.finalValue) || values[values.length - 1]) *
    Math.max(0, Math.min(1, (p - 0.65) / 0.35));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: bg,
        borderRadius: 16,
        padding: "5%",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        color: fg,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {(el.title || el.subtitle) && (
        <div style={{ flex: "0 0 auto" }}>
          {el.title && (
            <div style={{ fontSize: fontSize * 1.4, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {el.title}
            </div>
          )}
          {el.subtitle && (
            <div style={{ fontSize: fontSize * 0.75, opacity: 0.7, marginTop: 2 }}>
              {el.subtitle}
            </div>
          )}
        </div>
      )}
      <div style={{ flex: 1, position: "relative" }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
          {el.showGrid !== false && (
            <g stroke={`${fg}22`} strokeWidth={0.2}>
              {[0, 25, 50, 75, 100].map((y) => (
                <line key={y} x1={PAD * 100} x2={(1 - PAD) * 100} y1={y} y2={y} />
              ))}
            </g>
          )}
          {/* Filled area under the line, revealed left-to-right. */}
          <clipPath id={`clip-${el.id}`}>
            <rect x={0} y={0} width={p * 100} height={100} />
          </clipPath>
          <path d={areaPath} fill={fillColor} clipPath={`url(#clip-${el.id})`} />
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath={`url(#clip-${el.id})`}
          />
          {/* End-dot glow */}
          {p > 0.05 && (
            <circle
              cx={xy[Math.floor(p * (xy.length - 1))]?.x ?? xy[xy.length - 1].x}
              cy={xy[Math.floor(p * (xy.length - 1))]?.y ?? xy[xy.length - 1].y}
              r={1.4}
              fill={lineColor}
              style={{ filter: `drop-shadow(0 0 4px ${lineColor})` }}
            />
          )}
        </svg>
      </div>
      {/* Final value badge — appears as the line completes. */}
      {p > 0.65 && (
        <div
          style={{
            alignSelf: "flex-start",
            fontSize: fontSize * 1.8,
            fontWeight: 900,
            color: lineColor,
            letterSpacing: "-0.02em",
          }}
        >
          {el.valuePrefix || ""}
          {Math.round(animatedFinal).toLocaleString()}
          {el.valueSuffix || ""}
          {el.finalLabel && (
            <span style={{ fontSize: fontSize * 0.7, color: `${fg}99`, marginLeft: 8, fontWeight: 500 }}>
              {el.finalLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile — big animated number + label + optional caption + optional
// sparkline. Used for "$1.2M ARR", "98% retention", "4× faster" beats.
// ---------------------------------------------------------------------------
function StatElementBody({ el, height }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalDur = Math.max(0.3, Number(el.animationDuration) || 1.2);
  const seconds = frame / fps;
  const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
  const p = ease(seconds / totalDur);

  const fontSize = (Number(el.size) || 0.08) * height;
  const bg = el.bg || "rgba(8, 10, 20, 0.55)";
  const fg = el.fg || "#ffffff";
  const accent = el.accent || "#fbbf24";

  const finalValue = Number(el.value) || 0;
  const shown =
    el.countUp === false ? finalValue : Math.round(finalValue * p * 1000) / 1000;
  const formatted =
    Math.abs(shown) >= 1000
      ? Math.round(shown).toLocaleString()
      : Number.isInteger(finalValue)
      ? String(Math.round(shown))
      : shown.toFixed(1);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: bg,
        borderRadius: 16,
        padding: "8% 10%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 8,
        color: fg,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {el.label && (
        <div style={{ fontSize: fontSize * 0.5, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.65 }}>
          {el.label}
        </div>
      )}
      <div
        style={{
          fontSize: fontSize * 2.6,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          color: accent,
          textShadow: `0 8px 40px ${accent}55`,
          lineHeight: 1,
        }}
      >
        {el.valuePrefix || ""}
        {formatted}
        {el.valueSuffix || ""}
      </div>
      {Array.isArray(el.sparkline) && el.sparkline.length >= 2 && (
        <svg
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          style={{ width: "60%", height: fontSize * 1.1, opacity: 0.85 }}
        >
          {(() => {
            const vs = el.sparkline.map((n) => Number(n) || 0);
            const max = Math.max(...vs);
            const min = Math.min(...vs);
            const range = max - min || 1;
            const xy = vs.map((v, i) => ({
              x: (i / (vs.length - 1)) * 100,
              y: 22 - ((v - min) / range) * 20,
            }));
            const d = xy.reduce(
              (a, pt, i) => a + (i === 0 ? `M${pt.x},${pt.y}` : ` L${pt.x},${pt.y}`),
              ""
            );
            return (
              <>
                <path d={d + ` L100,24 L0,24 Z`} fill={`${accent}33`} />
                <path d={d} fill="none" stroke={accent} strokeWidth={1.4} strokeLinecap="round" />
              </>
            );
          })()}
        </svg>
      )}
      {el.caption && (
        <div style={{ fontSize: fontSize * 0.55, opacity: 0.75, marginTop: 4 }}>
          {el.caption}
        </div>
      )}
    </div>
  );
}

function BarChartElementBody({ el, height }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneTime = frame / fps;

  const bg = el.bg || "#f5efe6";
  const fg = el.fg || "#2a1f17";
  const bar = el.bar || "#d97b1a";
  const axisMax = el.axisMax || 100;
  const suffix = el.valueSuffix ?? "%";
  const showAxis = el.showAxis !== false;
  const showValues = el.showValues !== false;

  const titleFont = el.titleFont || "Georgia, 'Times New Roman', serif";
  const labelFont = el.labelFont || "Inter, system-ui, sans-serif";

  const cardH = el.h * height;
  const titleSize = Math.max(14, cardH * 0.085);
  const subtitleSize = Math.max(10, cardH * 0.04);
  const labelSize = Math.max(8, cardH * 0.033);
  const valueSize = Math.max(8, cardH * 0.04);
  const axisSize = Math.max(8, cardH * 0.032);

  const progress = computeBarChartProgressNode(el, sceneTime);
  const rows = Array.isArray(el.rows) ? el.rows : [];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: bg,
        color: fg,
        padding: `${cardH * 0.06}px ${cardH * 0.07}px`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: cardH * 0.025,
        overflow: "hidden",
        borderRadius: 6,
        fontFamily: labelFont,
      }}
    >
      {el.title ? (
        <div
          style={{
            fontFamily: titleFont,
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.1,
            opacity: progress.titleP,
            transform: `translateY(${(1 - progress.titleP) * 16}px)`,
          }}
        >
          {el.title}
        </div>
      ) : null}

      {el.subtitle ? (
        <div
          style={{
            fontFamily: labelFont,
            fontStyle: "italic",
            fontSize: subtitleSize,
            opacity: progress.subtitleP * 0.85,
            transform: `translateY(${(1 - progress.subtitleP) * 10}px)`,
            lineHeight: 1.3,
            maxWidth: "92%",
          }}
        >
          {el.subtitle}
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: cardH * 0.045,
          paddingTop: cardH * 0.02,
        }}
      >
        {rows.map((row, i) => {
          const p = progress.rowsP[i] || 0;
          const target = Math.max(0, Math.min(axisMax, Number(row.value) || 0));
          const widthFrac = (target / axisMax) * p;
          const display = Math.round(target * p);

          return (
            <div
              key={`${i}-${row.label}`}
              style={{ display: "flex", flexDirection: "column", gap: cardH * 0.012 }}
            >
              <div
                style={{
                  fontSize: labelSize,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  opacity: 0.95,
                }}
              >
                {row.label}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: cardH * 0.02 }}>
                <div
                  style={{
                    flex: 1,
                    height: cardH * 0.05,
                    background: "transparent",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${widthFrac * 100}%`,
                      background: bar,
                    }}
                  />
                </div>
                {showValues && (
                  <div
                    style={{
                      minWidth: cardH * 0.09,
                      textAlign: "right",
                      fontSize: valueSize,
                      fontWeight: 600,
                      opacity: p,
                    }}
                  >
                    {display}
                    {suffix}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAxis && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingRight: showValues ? cardH * 0.11 : 0,
            fontSize: axisSize,
            opacity: progress.axisP * 0.65,
            fontWeight: 500,
            marginTop: cardH * 0.01,
          }}
        >
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((step) => (
            <span key={step}>
              {Math.round(step * axisMax)}
              {suffix}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Karaoke subtitle element — same logic as the editor's SubtitleBody so a
// drag in the canvas lines up with the MP4 frame-for-frame. Uses the parent
// Sequence's local frame, which restarts at 0 for each scene clip.
// ---------------------------------------------------------------------------
function buildElementWordTimings(el, totalSeconds) {
  if (Array.isArray(el?.wordTimings) && el.wordTimings.length) {
    return el.wordTimings.map((w) => ({
      word: String(w.word || ""),
      start: Number(w.start) || 0,
      end: Number(w.end) || 0,
    }));
  }
  const raw = String(el?.text || "").trim();
  if (!raw || totalSeconds <= 0) return [];
  const tokens = raw.split(/\s+/).filter(Boolean);
  const weights = tokens.map((t) => t.replace(/[^\p{L}\p{N}']/gu, "").length + 1);
  const sum = weights.reduce((a, b) => a + b, 0) || tokens.length;
  let cursor = 0;
  return tokens.map((word, i) => {
    const slice = (weights[i] / sum) * totalSeconds;
    const start = cursor;
    cursor += slice;
    return { word, start, end: cursor };
  });
}

function SubtitleElementBody({ el, height }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  // Prefer the element's own duration; otherwise fall back to the parent
  // Sequence length (a scene clip in the timeline path, or the comp in the
  // simple Series path).
  const totalSeconds = (el.duration && el.duration > 0
    ? el.duration
    : durationInFrames / fps) || 0;
  const seconds = frame / fps;

  const fontSize = (el.size ?? 0.07) * height;
  const baseColor = el.color || "#ffffff";
  const accent = el.accent || "#8b5cf6";
  const future = el.futureOpacity ?? 0.45;
  const timings = buildElementWordTimings(el, totalSeconds);

  let currentIndex = -1;
  for (let i = 0; i < timings.length; i++) {
    if (seconds >= timings[i].start && seconds < timings[i].end) {
      currentIndex = i;
      break;
    }
  }
  if (currentIndex === -1 && timings.length && seconds >= timings[timings.length - 1].end) {
    currentIndex = timings.length;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: `${fontSize * 0.18}px ${fontSize * 0.35}px`,
        padding: "8px 16px",
        background: "rgba(8, 10, 20, 0.55)",
        borderRadius: 16,
        fontFamily: el.font || "Inter, system-ui, sans-serif",
        fontWeight: el.weight || 800,
        overflow: "hidden",
      }}
    >
      {timings.length === 0 ? (
        <span style={{ color: baseColor, fontSize, opacity: 0.6 }}>{el.text || ""}</span>
      ) : (
        timings.map((t, i) => {
          const isCurrent = i === currentIndex;
          const isPast = i < currentIndex;
          // Smooth color/scale transition around each word boundary.
          const enterAt = Math.round(t.start * fps);
          const exitAt = Math.round(t.end * fps);
          const enter = interpolate(frame, [enterAt - 3, enterAt + 3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const exit = interpolate(frame, [exitAt - 3, exitAt + 3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const active = enter * (1 - exit);

          const color = isCurrent ? accent : isPast ? baseColor : baseColor;
          const opacity = isCurrent || isPast ? 1 : future;
          const scale = 1 + active * 0.1;
          const glow = isCurrent
            ? `0 0 18px ${accent}aa, 0 4px 14px ${accent}55`
            : "none";

          return (
            <span
              key={`${t.word}-${i}`}
              style={{
                display: "inline-block",
                color,
                opacity,
                fontSize,
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
                transform: `scale(${scale})`,
                transformOrigin: "center bottom",
                textShadow: glow,
                whiteSpace: "pre",
              }}
            >
              {t.word}
            </span>
          );
        })
      )}
    </div>
  );
}

function sceneShell(base, accent, secondary, frame, durationInFrames, variant) {
  const drift = interpolate(frame, [0, durationInFrames], [-24, 24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let background;
  if (variant?.bg === "diagonal") {
    background =
      `linear-gradient(${68 + drift / 8}deg, ${accent}33 0%, transparent 45%), ` +
      `linear-gradient(135deg, ${base} 0%, #0b1020 100%)`;
  } else if (variant?.bg === "corner-spotlight") {
    const spot = {
      tl: [14, 18],
      tr: [86, 18],
      bl: [14, 82],
      br: [86, 82],
    }[variant.accentCorner] || [50, 50];
    background =
      `radial-gradient(circle at ${spot[0]}% ${spot[1]}%, ${accent}77 0%, transparent 38%), ` +
      `linear-gradient(180deg, ${base} 0%, #0b1020 100%)`;
  } else if (variant?.bg === "mesh") {
    // Gradient mesh — 3 overlapping radial blobs drifting in opposite
    // directions. Looks distinct from radial-glow because of the second
    // accent ring and the off-axis drift on each blob.
    background =
      `radial-gradient(circle at ${20 + drift / 6}% ${30 - drift / 10}%, ${accent}55 0%, transparent 38%), ` +
      `radial-gradient(circle at ${80 - drift / 8}% ${28 + drift / 14}%, ${secondary}55 0%, transparent 36%), ` +
      `radial-gradient(circle at ${50 + drift / 10}% ${82 - drift / 18}%, ${accent}33 0%, transparent 42%), ` +
      `linear-gradient(135deg, ${base} 0%, #0b1020 100%)`;
  } else if (variant?.bg === "noise") {
    // Subtle scanline + dot-noise pattern over a flat gradient. Layered
    // with SVG data-uri so it stays crisp at any resolution.
    const noise =
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.08 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
    background =
      `${noise}, ` +
      `linear-gradient(220deg, ${accent}25 0%, transparent 35%), ` +
      `linear-gradient(135deg, ${base} 0%, #0b1020 100%)`;
  } else {
    // "radial-glow" (the original look)
    background =
      `radial-gradient(circle at ${48 + drift / 8}% 34%, ${accent}66 0%, transparent 34%), ` +
      `radial-gradient(circle at ${78 - drift / 12}% 78%, ${secondary}44 0%, transparent 30%), ` +
      `linear-gradient(135deg, ${base} 0%, #0b1020 100%)`;
  }

  return {
    overflow: "hidden",
    background,
    color: "#ffffff",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  };
}

function SceneChrome({ accent, index, variant }) {
  const accentCorner = variant?.accentCorner || "tl";
  const numberCorner = variant?.numberCorner || "br";
  const gridSize = variant?.gridSize ?? 72;
  // Bars in left/right corners run horizontal; top/bottom-only corners (none
  // here) — keep all bars horizontal to stay tasteful.
  return (
    <>
      {gridSize > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: `${gridSize}px ${gridSize}px`,
            opacity: 0.28,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          ...CORNER_POS[accentCorner],
          width: 84,
          height: 6,
          borderRadius: 99,
          backgroundColor: accent,
          boxShadow: `0 0 28px ${accent}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          ...CORNER_POS[numberCorner],
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.22)",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>
    </>
  );
}

function TextStack({ scene, style, align = "left", width = 720, large = false, sizeScale = 1 }) {
  const title = scene.headline || scene.text;
  const subtext = scene.subtext || scene.visual;
  const titleSize = Math.round((large ? 86 : 68) * sizeScale);
  const subSize = Math.round((large ? 30 : 25) * sizeScale);

  return (
    <div
      style={{
        width,
        textAlign: align,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: titleSize,
          lineHeight: 0.96,
          fontWeight: 850,
          letterSpacing: "-0.03em",
          textWrap: "balance",
        }}
      >
        {title}
      </div>
      {subtext ? (
        <div
          style={{
            marginTop: 28,
            fontSize: subSize,
            lineHeight: 1.28,
            fontWeight: 550,
            color: "rgba(255,255,255,0.78)",
            textWrap: "balance",
          }}
        >
          {subtext}
        </div>
      ) : null}
    </div>
  );
}

function LottiePanel({ scene, accent, secondary }) {
  const animationData =
    scene.lottieAnimationData || getLottieAsset(scene.lottieAsset)?.animationData;

  // No animation selected/uploaded for this scene — render nothing.
  if (!animationData) return null;

  return (
    <div
      style={{
        width: 520,
        height: 520,
        borderRadius: 42,
        background:
          `linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06)), ` +
          `radial-gradient(circle at 38% 28%, ${accent}55, transparent 52%), ` +
          `radial-gradient(circle at 72% 72%, ${secondary}44, transparent 48%)`,
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 36px 90px rgba(0,0,0,0.36)",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <Lottie
        animationData={animationData}
        loop
        renderer="svg"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: 390, height: 390 }}
      />
    </div>
  );
}

function MotionBackdrop({ accent, secondary, frame, durationInFrames }) {
  const drift = interpolate(frame, [0, durationInFrames], [-120, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slow = Math.sin(frame / 18);
  const fast = Math.sin(frame / 9);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: "-18%",
          background:
            `linear-gradient(${112 + drift / 10}deg, transparent 0%, ${accent}22 38%, transparent 56%), ` +
            `linear-gradient(${34 - drift / 12}deg, transparent 8%, ${secondary}1f 46%, transparent 68%)`,
          transform: `translateX(${drift * 0.18}px) rotate(${slow * 2}deg)`,
          opacity: 0.8,
        }}
      />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 260 + i * 120,
            height: 260 + i * 120,
            borderRadius: "50%",
            border: `1px solid ${i % 2 ? secondary : accent}55`,
            left: `${12 + i * 27 + slow * 2}%`,
            top: `${14 + i * 17 + fast * 2}%`,
            transform: `scale(${1 + Math.sin(frame / (22 + i * 6)) * 0.08})`,
            opacity: 0.22,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: "-10%",
          right: "-10%",
          top: `${50 + fast * 8}%`,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          boxShadow: `0 0 38px ${accent}`,
          opacity: 0.48,
          transform: `rotate(${slow * 5}deg)`,
        }}
      />
    </AbsoluteFill>
  );
}

function sceneText(scene) {
  // Empty string (not a fallback) when the AI left the headline blank — the
  // foreground elements layer will provide the real title in that case.
  // The old "Your idea in motion" fallback was causing both the template's
  // headline AND the element-layer title to render at once and overlap.
  const title = (scene.headline || scene.text || "").trim();
  const subtext = (scene.subtext || scene.visual || "").trim();
  return { title, subtext };
}

function reveal(frame, start, duration = 16) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ---------------------------------------------------------------------------
// Karaoke-style subtitle timing. If the scene supplies real per-word timings
// (e.g. from forced alignment) we trust them; otherwise we distribute the
// scene duration across the words weighted by character length so longer
// words occupy proportionally more time. Good-enough sync without extra deps.
// ---------------------------------------------------------------------------
function buildWordTimings(scene, totalSeconds) {
  const supplied = Array.isArray(scene?.wordTimings) ? scene.wordTimings : null;
  if (supplied && supplied.length) {
    return supplied.map((w) => ({
      word: String(w.word || ""),
      start: Number(w.start) || 0,
      end: Number(w.end) || 0,
    }));
  }
  const raw = String(scene?.narration || scene?.text || scene?.headline || "").trim();
  if (!raw) return [];
  const tokens = raw.split(/\s+/).filter(Boolean);
  // Weight = character count + 1 (so a 1-letter word still gets some time).
  const weights = tokens.map((t) => t.replace(/[^\p{L}\p{N}']/gu, "").length + 1);
  const sum = weights.reduce((a, b) => a + b, 0) || tokens.length;
  let cursor = 0;
  return tokens.map((word, i) => {
    const slice = (weights[i] / sum) * totalSeconds;
    const start = cursor;
    cursor += slice;
    return { word, start, end: cursor };
  });
}

function KaraokeSubtitle(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = props.durationInFrames || 1;
  const totalSeconds = durationInFrames / fps;
  const seconds = frame / fps;

  const { title } = sceneText(props.scene);
  const timings = buildWordTimings(props.scene, totalSeconds);

  // Headline floats above the subtitle band for context. Fade in early.
  const headlineP = reveal(frame, 4, 18);

  // Find the currently-spoken word index. Past words stay full bright,
  // future words sit dim, the current word pops to the accent color.
  let currentIndex = -1;
  for (let i = 0; i < timings.length; i++) {
    if (seconds >= timings[i].start && seconds < timings[i].end) {
      currentIndex = i;
      break;
    }
  }
  // After the last word's end, treat everything as spoken.
  if (currentIndex === -1 && timings.length && seconds >= timings[timings.length - 1].end) {
    currentIndex = timings.length;
  }

  const fontFamily =
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 9% 9% 9%", ...props.style }}>
      {title ? (
        <div
          style={{
            color: "rgba(255,255,255,0.92)",
            fontSize: 64,
            lineHeight: 1.02,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            marginBottom: 56,
            textAlign: "center",
            textShadow: `0 16px 60px ${props.accent}55`,
            opacity: headlineP,
            transform: `translateY(${(1 - headlineP) * 24}px)`,
            fontFamily,
          }}
        >
          {title}
        </div>
      ) : null}

      {/* Subtitle band — a frosted card behind the words for legibility */}
      <div
        style={{
          alignSelf: "center",
          maxWidth: "92%",
          padding: "28px 44px",
          borderRadius: 28,
          background: "rgba(8, 10, 20, 0.55)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "10px 22px",
          fontFamily,
        }}
      >
        {timings.map((t, i) => {
          const isCurrent = i === currentIndex;
          const isPast = i < currentIndex;
          // Smooth color / scale transition around the boundary so the
          // highlight glides rather than snaps. ~3 frames each side.
          const boundary = Math.round(t.start * fps);
          const enter = interpolate(frame, [boundary - 3, boundary + 3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const exitBoundary = Math.round(t.end * fps);
          const exit = interpolate(frame, [exitBoundary - 3, exitBoundary + 3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          // active = ramped up (entered) but not yet exited
          const active = enter * (1 - exit);

          const color = isCurrent
            ? props.accent
            : isPast
            ? "#ffffff"
            : "rgba(255,255,255,0.45)";
          const scale = 1 + active * 0.10;
          const glow = isCurrent
            ? `0 0 30px ${props.accent}aa, 0 6px 24px ${props.accent}55`
            : "none";

          return (
            <span
              key={`${t.word}-${i}`}
              style={{
                display: "inline-block",
                color,
                fontSize: 56,
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
                transform: `scale(${scale})`,
                transformOrigin: "center bottom",
                textShadow: glow,
                transition: "none",
              }}
            >
              {t.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function KineticTitle(props) {
  const frame = useCurrentFrame();
  const { title, subtext } = sceneText(props.scene);
  const words = title.split(/\s+/).filter(Boolean).slice(0, 9);

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "8% 9%" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "18px 28px",
          maxWidth: 1200,
          ...props.style,
        }}
      >
        {words.map((word, i) => {
          const p = reveal(frame, i * 5, 18);
          return (
            <span
              key={`${word}-${i}`}
              style={{
                display: "inline-block",
                color: "#ffffff",
                fontSize: i === 0 ? 104 : 92,
                lineHeight: 0.92,
                fontWeight: 900,
                textTransform: i % 3 === 0 ? "uppercase" : "none",
                textShadow: `0 16px 60px ${props.accent}66`,
                opacity: p,
                transform: `translateY(${(1 - p) * 72}px) scale(${0.88 + p * 0.12})`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
      {subtext ? (
        <div
          style={{
            marginTop: 42,
            maxWidth: 820,
            color: "rgba(255,255,255,0.78)",
            fontSize: 30,
            lineHeight: 1.25,
            fontWeight: 650,
            opacity: reveal(frame, 34, 18),
          }}
        >
          {subtext}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

function AnimatedBgText(props) {
  const frame = useCurrentFrame();
  const { title, subtext } = sceneText(props.scene);
  const p = reveal(frame, 4, 22);
  const line = interpolate(frame, [18, 54], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "9%" }}>
      <div
        style={{
          position: "absolute",
          width: "72%",
          height: "46%",
          borderRadius: 56,
          background: `linear-gradient(135deg, ${props.accent}18, rgba(255,255,255,0.08), ${props.secondary}18)`,
          border: "1px solid rgba(255,255,255,0.14)",
          transform: `rotate(${Math.sin(frame / 24) * 2}deg) scale(${0.96 + p * 0.04})`,
          boxShadow: "0 44px 120px rgba(0,0,0,0.34)",
        }}
      />
      <div style={{ width: 1100, textAlign: "center", zIndex: 1, ...props.style }}>
        <div
          style={{
            color: "#ffffff",
            fontSize: 92,
            lineHeight: 0.98,
            fontWeight: 900,
            textShadow: "0 18px 80px rgba(0,0,0,0.48)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            width: `${line * 100}%`,
            height: 5,
            margin: "34px auto 0",
            borderRadius: 99,
            background: `linear-gradient(90deg, ${props.accent}, #ffffff, ${props.secondary})`,
            boxShadow: `0 0 34px ${props.accent}`,
          }}
        />
        {subtext ? (
          <div
            style={{
              marginTop: 30,
              color: "rgba(255,255,255,0.78)",
              fontSize: 28,
              lineHeight: 1.28,
              fontWeight: 650,
            }}
          >
            {subtext}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

function AppShowcase(props) {
  const frame = useCurrentFrame();
  const { title, subtext } = sceneText(props.scene);
  const phoneIn = reveal(frame, 8, 24);
  const TextIcon = LucideIcons.MousePointerClick || LucideIcons.Sparkles;

  return (
    <AbsoluteFill
      style={{
        display: "grid",
        gridTemplateColumns: props.variant?.flip ? "0.86fr 1.14fr" : "1.14fr 0.86fr",
        alignItems: "center",
        gap: 76,
        padding: "7% 9%",
      }}
    >
      <div style={{ order: props.variant?.flip ? 2 : 1, ...props.style }}>
        <div style={{ color: "#ffffff", fontSize: 78, lineHeight: 1, fontWeight: 900 }}>
          {title}
        </div>
        <div style={{ marginTop: 30, color: "rgba(255,255,255,0.76)", fontSize: 27, lineHeight: 1.28, fontWeight: 650 }}>
          {subtext || "A smooth app experience, built for action."}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginTop: 42,
            padding: "16px 24px",
            borderRadius: 999,
            background: "#ffffff",
            color: "#0b1020",
            fontSize: 24,
            fontWeight: 850,
            boxShadow: `0 22px 70px ${props.accent}55`,
          }}
        >
          <TextIcon size={28} />
          Tap. Order. Done.
        </div>
      </div>

      <div
        style={{
          order: props.variant?.flip ? 1 : 2,
          justifySelf: "center",
          width: 360,
          height: 650,
          borderRadius: 56,
          padding: 18,
          background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.72))",
          boxShadow: "0 46px 120px rgba(0,0,0,0.42)",
          transform: `translateY(${(1 - phoneIn) * 90}px) rotate(${props.variant?.flip ? -4 : 4}deg) scale(${0.9 + phoneIn * 0.1})`,
          opacity: phoneIn,
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 42, background: "#0b1020", overflow: "hidden", padding: 24 }}>
          <div style={{ width: 92, height: 8, borderRadius: 99, background: "rgba(255,255,255,0.22)", margin: "0 auto 32px" }} />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                marginTop: i ? 18 : 0,
                height: 118,
                borderRadius: 26,
                background: `linear-gradient(135deg, ${i % 2 ? props.secondary : props.accent}44, rgba(255,255,255,0.1))`,
                border: "1px solid rgba(255,255,255,0.12)",
                transform: `translateX(${(1 - reveal(frame, 20 + i * 7, 18)) * 48}px)`,
                opacity: reveal(frame, 20 + i * 7, 18),
              }}
            />
          ))}
          <div
            style={{
              marginTop: 26,
              height: 66,
              borderRadius: 999,
              background: "#ffffff",
              color: "#0b1020",
              display: "grid",
              placeItems: "center",
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            Order now
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function OfferBurst(props) {
  const frame = useCurrentFrame();
  const { title, subtext } = sceneText(props.scene);
  const burst = reveal(frame, 6, 18);
  const pulse = 1 + Math.sin(frame / 8) * 0.035;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "8%" }}>
      <div
        style={{
          position: "absolute",
          width: 680,
          height: 680,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${props.accent}66 0%, ${props.secondary}22 42%, transparent 68%)`,
          transform: `scale(${(0.65 + burst * 0.35) * pulse})`,
          opacity: 0.86,
        }}
      />
      <div
        style={{
          zIndex: 1,
          textAlign: "center",
          color: "#ffffff",
          maxWidth: 1120,
          ...props.style,
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 850, textTransform: "uppercase", color: props.accent }}>
          Limited time
        </div>
        <div style={{ marginTop: 18, fontSize: 104, lineHeight: 0.92, fontWeight: 950, textShadow: "0 20px 90px rgba(0,0,0,0.46)" }}>
          {title}
        </div>
        <div style={{ marginTop: 34, fontSize: 31, lineHeight: 1.25, color: "rgba(255,255,255,0.82)", fontWeight: 700 }}>
          {subtext || "Make the offer impossible to miss."}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ProofCards(props) {
  const frame = useCurrentFrame();
  const Check = LucideIcons.CheckCircle2 || LucideIcons.CircleCheck || LucideIcons.Sparkles;
  const { title, subtext } = sceneText(props.scene);
  const items = [
    title,
    subtext || "Fast, simple, and ready to share",
    props.scene.visual || "Built for high-converting ads",
  ];

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "7% 9%" }}>
      <div style={{ color: "#ffffff", fontSize: 70, lineHeight: 1, fontWeight: 900, maxWidth: 980, ...props.style }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 56 }}>
        {items.map((item, i) => {
          const p = reveal(frame, 14 + i * 8, 18);
          return (
            <div
              key={`${item}-${i}`}
              style={{
                minHeight: 238,
                borderRadius: 34,
                padding: 30,
                background: "rgba(255,255,255,0.13)",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "0 30px 90px rgba(0,0,0,0.28)",
                opacity: p,
                transform: `translateY(${(1 - p) * 54}px)`,
              }}
            >
              <div style={{ color: i % 2 ? props.secondary : props.accent }}>
                <Check size={42} />
              </div>
              <div style={{ marginTop: 28, color: "#ffffff", fontSize: 28, lineHeight: 1.12, fontWeight: 850 }}>
                {item}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function FinalCta(props) {
  const frame = useCurrentFrame();
  const { title, subtext } = sceneText(props.scene);
  const glow = 0.7 + Math.sin(frame / 10) * 0.3;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "9%" }}>
      <div style={{ textAlign: "center", maxWidth: 1160, color: "#ffffff", ...props.style }}>
        <div style={{ fontSize: 96, lineHeight: 0.96, fontWeight: 950, textShadow: `0 18px 90px ${props.accent}66` }}>
          {title}
        </div>
        {subtext ? (
          <div style={{ marginTop: 30, fontSize: 30, lineHeight: 1.28, color: "rgba(255,255,255,0.78)", fontWeight: 650 }}>
            {subtext}
          </div>
        ) : null}
        <div
          style={{
            display: "inline-flex",
            marginTop: 48,
            padding: "20px 34px",
            borderRadius: 999,
            background: "#ffffff",
            color: "#0b1020",
            fontSize: 28,
            fontWeight: 900,
            boxShadow: `0 0 ${Math.round(34 + glow * 38)}px ${props.accent}`,
            transform: `scale(${1 + Math.sin(frame / 12) * 0.025})`,
          }}
        >
          Get started now
        </div>
      </div>
    </AbsoluteFill>
  );
}

function LegacyCardsUnused(props) {
  const frame = useCurrentFrame();
  // Lottie no longer auto-placed inside cards — kept clean and text-driven.
  const items = [
    props.scene.headline || props.scene.text,
    props.scene.subtext || "Automated motion design",
    props.scene.visual || "Ready for export",
  ];

  const align = props.variant?.align ?? "left";
  const sizeScale = props.variant?.sizeScale ?? 1;

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "8% 9%" }}>
      <TextStack scene={props.scene} style={props.style} width={1040} align={align} sizeScale={sizeScale} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 54 }}>
        {items.map((item, i) => (
          <div
            key={item}
            style={{
              minHeight: 190,
              borderRadius: 30,
              padding: 28,
              background: "rgba(255,255,255,0.13)",
              border: "1px solid rgba(255,255,255,0.18)",
              boxShadow: "0 26px 70px rgba(0,0,0,0.24)",
              transform: `translateY(${interpolate(frame, [i * 8, i * 8 + 20], [36, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
              opacity: interpolate(frame, [i * 8, i * 8 + 20], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <div style={{ marginTop: 0, fontSize: 27, lineHeight: 1.1, fontWeight: 800 }}>
              {item}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function LegacyEndScreenUnused(props) {
  const sizeScale = props.variant?.sizeScale ?? 1;
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: "10%",
      }}
    >
      {/* Lottie removed from generation; admin uploads now reach the canvas only. */}
      <div style={{ marginTop: 42 }}>
        <TextStack scene={props.scene} style={props.style} align="center" width={1100} large sizeScale={sizeScale} />
      </div>
    </AbsoluteFill>
  );
}
