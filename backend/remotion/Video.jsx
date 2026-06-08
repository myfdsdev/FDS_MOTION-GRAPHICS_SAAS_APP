/**
 * ELEMENTS-FIRST REMOTION COMPOSITION
 *
 * ALL visible content lives in elements[]. Scene themes provide animated
 * backgrounds. Every element has per-element entrance/exit animations.
 * Fully editable and draggable in the editor.
 *
 * For final renders, the AI-generated JSX code (generated/Current.jsx)
 * is used instead — this composition serves editor preview and fallback.
 */

import { Lottie } from "@remotion/lottie";
import * as LucideIcons from "lucide-react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Series,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getSceneStyle } from "./animations.js";
import { getElementMotion } from "./elementMotion.js";

const DEFAULT_COLORS = ["#0f172a", "#8b5cf6", "#38bdf8", "#34d399"];
const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════
export const Video = ({ brandColors, scenes, timeline, structureSeed = 0 }) => {
  const { fps } = useVideoConfig();
  const colors = Array.isArray(brandColors) && brandColors.length ? brandColors : DEFAULT_COLORS;

  if (timeline && Array.isArray(timeline.tracks) && timeline.tracks.length) {
    return <TimelineVideo timeline={timeline} colors={colors} />;
  }

  const list = Array.isArray(scenes) && scenes.length ? scenes : [];
  return (
    <AbsoluteFill style={{ backgroundColor: colors[0] }}>
      <Series>
        {list.map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={Math.max(1, Math.round((Number(scene.duration) || 4) * fps))}>
            <SceneRenderer scene={scene} colors={colors} index={i} structureSeed={structureSeed} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SCENE RENDERER — elements-first motion graphics
// ═══════════════════════════════════════════════════════════════════════════

function SceneRenderer({ scene, colors, index, clipDurationInFrames, structureSeed = 0 }) {
  const frame = useCurrentFrame();
  const cfg = useVideoConfig();
  const { fps, width, height } = cfg;
  const dur = clipDurationInFrames ?? cfg.durationInFrames;
  const style = getSceneStyle(scene.animation, frame, fps, dur);

  const base = colors[0] ?? DEFAULT_COLORS[0];
  const accent = colors[(index % Math.max(1, colors.length - 1)) + 1] ?? colors[1] ?? DEFAULT_COLORS[1];
  const secondary = colors[(index + 2) % colors.length] ?? DEFAULT_COLORS[2];
  const variant = pickVariant(scene, index, structureSeed);
  const theme = scene.sceneTheme || scene.sceneTemplate || "gradient-flow";
  const hasElements = Array.isArray(scene.elements) && scene.elements.length > 0;

  return (
    <AbsoluteFill style={{ ...style, overflow: "hidden" }}>
      <ThemeBackground theme={theme} base={base} accent={accent} secondary={secondary} frame={frame} dur={dur} />
      <ChromeOverlay accent={accent} index={index} variant={variant} frame={frame} dur={dur} />
      <FloatingShapes accent={accent} secondary={secondary} frame={frame} dur={dur} />

      {hasElements ? (
        <ElementsLayer elements={scene.elements} width={width} height={height} sceneTime={frame / fps} sceneDuration={dur / fps} />
      ) : (
        <FallbackText headline={scene.headline} subtext={scene.subtext} accent={accent} frame={frame} />
      )}
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Theme Backgrounds
// ═══════════════════════════════════════════════════════════════════════════

function ThemeBackground({ theme, base, accent, secondary, frame, dur }) {
  const d = interpolate(frame, [0, dur], [-24, 24], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bgs = {
    "gradient-flow": `radial-gradient(circle at ${48 + d / 8}% 34%, ${accent}66 0%, transparent 34%), radial-gradient(circle at ${78 - d / 12}% 78%, ${secondary}44 0%, transparent 30%), linear-gradient(135deg, ${base} 0%, #0b1020 100%)`,
    "geometric": `linear-gradient(${45 + d / 4}deg, ${accent}22 0%, transparent 50%), linear-gradient(${135 - d / 6}deg, ${secondary}18 0%, transparent 40%), linear-gradient(180deg, ${base} 0%, ${base}ee 100%)`,
    "spotlight": `radial-gradient(ellipse at ${50 + d / 6}% ${40 + d / 10}%, ${accent}55 0%, transparent 45%), linear-gradient(180deg, #050510 0%, #0a0a1a 100%)`,
    "split-tone": `linear-gradient(${120 + d / 8}deg, ${accent}44 0%, ${accent}11 50%, ${secondary}22 50%, ${secondary}05 100%), linear-gradient(135deg, ${base} 0%, #0b1020 100%)`,
    "minimal-dark": `linear-gradient(180deg, ${base} 0%, #0a0a14 100%)`,
    "minimal-light": `linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)`,
    "mesh-gradient": `radial-gradient(circle at ${20 + d / 6}% ${30 - d / 10}%, ${accent}55 0%, transparent 38%), radial-gradient(circle at ${80 - d / 8}% ${28 + d / 14}%, ${secondary}55 0%, transparent 36%), radial-gradient(circle at ${50 + d / 10}% ${82 - d / 18}%, ${accent}33 0%, transparent 42%), linear-gradient(135deg, ${base} 0%, #0b1020 100%)`,
    "particle-field": `radial-gradient(circle at ${30 + d / 4}% ${50 - d / 8}%, ${accent}33 0%, transparent 25%), radial-gradient(circle at ${70 - d / 6}% ${60 + d / 12}%, ${secondary}28 0%, transparent 22%), linear-gradient(180deg, ${base} 0%, #080818 100%)`,
    "aurora": `linear-gradient(${90 + d}deg, ${accent}44 0%, transparent 30%), linear-gradient(${180 + d / 2}deg, ${secondary}33 10%, transparent 40%), linear-gradient(${270 - d / 3}deg, ${accent}22 20%, transparent 50%), linear-gradient(180deg, ${base} 0%, #0b0b20 100%)`,
    "bold-color": `radial-gradient(circle at 50% 50%, ${accent}88 0%, ${accent}44 60%, ${base} 100%)`,
  };
  return <AbsoluteFill style={{ background: bgs[theme] || bgs["gradient-flow"], color: theme === "minimal-light" ? "#1e293b" : "#fff" }} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// Chrome & Floating Shapes
// ═══════════════════════════════════════════════════════════════════════════

const CORNERS = ["tl", "tr", "bl", "br"];
const GRID_SIZES = [0, 56, 72, 96, 120];
const CORNER_POS = { tl: { top: "8%", left: "6%" }, tr: { top: "8%", right: "6%" }, bl: { bottom: "8%", left: "6%" }, br: { bottom: "8%", right: "6%" } };

function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }

function pickVariant(scene, index, seed = 0) {
  const s = hashStr(`${index}|${scene?.headline || scene?.text || ""}`) ^ (Number(seed) || 0);
  return { accentCorner: CORNERS[s % 4], numberCorner: CORNERS[(s >> 2) % 4], gridSize: GRID_SIZES[(s >> 4) % GRID_SIZES.length], flip: ((s >> 6) & 1) === 1 };
}

function ChromeOverlay({ accent, index, variant, frame, dur }) {
  const gridSize = variant?.gridSize ?? 72;
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <>
      {gridSize > 0 && (
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: `${gridSize}px ${gridSize}px`, opacity: 0.25 * fadeIn }} />
      )}
      <div style={{ position: "absolute", ...CORNER_POS[variant?.accentCorner || "tl"], width: 84, height: 6, borderRadius: 99, backgroundColor: accent, boxShadow: `0 0 28px ${accent}`, opacity: fadeIn }} />
      <div style={{ position: "absolute", ...CORNER_POS[variant?.numberCorner || "br"], fontSize: 30, fontWeight: 800, letterSpacing: "0.12em", color: `rgba(255,255,255,${0.18 * fadeIn})`, fontFamily: FONT }}>
        {String(index + 1).padStart(2, "0")}
      </div>
    </>
  );
}

function FloatingShapes({ accent, secondary, frame, dur }) {
  const p = frame / Math.max(1, dur);
  const shapes = [
    { x: 15, y: 20, sz: 180, c: accent, dx: 30, dy: -20, del: 0 },
    { x: 75, y: 70, sz: 120, c: secondary, dx: -25, dy: 15, del: 0.2 },
    { x: 50, y: 85, sz: 90, c: accent, dx: 20, dy: -30, del: 0.4 },
  ];
  return (
    <AbsoluteFill style={{ opacity: 0.07, pointerEvents: "none" }}>
      {shapes.map((s, i) => {
        const t = Math.max(0, p - s.del);
        return <div key={i} style={{ position: "absolute", left: `${s.x + s.dx * t}%`, top: `${s.y + s.dy * t}%`, width: s.sz, height: s.sz, borderRadius: "50%", background: `radial-gradient(circle, ${s.c}66, transparent 70%)`, filter: "blur(40px)" }} />;
      })}
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Fallback Text (no elements)
// ═══════════════════════════════════════════════════════════════════════════

function FallbackText({ headline, subtext, accent, frame }) {
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const slideUp = interpolate(frame, [0, 14], [30, 0], { extrapolateRight: "clamp" });
  if (!headline && !subtext) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "8%", opacity: fadeIn, transform: `translateY(${slideUp}px)` }}>
      {headline && <div style={{ fontSize: 72, fontWeight: 850, letterSpacing: "-0.03em", textAlign: "center", lineHeight: 0.96, textWrap: "balance", fontFamily: FONT, textShadow: `0 4px 30px ${accent}55` }}>{headline}</div>}
      {subtext && <div style={{ marginTop: 28, fontSize: 28, fontWeight: 550, textAlign: "center", color: "rgba(255,255,255,0.75)", textWrap: "balance", fontFamily: FONT }}>{subtext}</div>}
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Elements Layer (renders ALL element types with animations)
// ═══════════════════════════════════════════════════════════════════════════

function ElementsLayer({ elements, width, height, sceneTime, sceneDuration }) {
  const ordered = [...elements].filter((e) => !e.hidden).sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  return (
    <AbsoluteFill>
      {ordered.map((el) => {
        const motion = getElementMotion(el.animation, sceneTime, sceneDuration);
        return (
          <div key={el.id} style={{ position: "absolute", left: el.x * width, top: el.y * height, width: el.w * width, height: el.h * height, transform: `rotate(${el.rotation || 0}deg) ${motion.transform}`, transformOrigin: "center", opacity: (el.opacity ?? 1) * motion.opacity }}>
            <ElBody el={el} height={height} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

// ── Element Body Renderers ───────────────────────────────────────────────

function ElBody({ el, height }) {
  switch (el.type) {
    case "text": return <TextEl el={el} height={height} />;
    case "icon": return <IconEl el={el} />;
    case "image": return <ImageEl el={el} />;
    case "shape": return <ShapeEl el={el} />;
    case "bar-chart": return <BarChartEl el={el} height={height} />;
    case "line-chart": return <LineChartEl el={el} height={height} />;
    case "stat": return <StatEl el={el} height={height} />;
    case "subtitle": return <SubtitleEl el={el} height={height} />;
    case "lottie": return el.animationData ? <Lottie animationData={el.animationData} loop={el.loop !== false} playbackRate={el.speed || 1} style={{ width: "100%", height: "100%" }} /> : null;
    default: return null;
  }
}

function TextEl({ el, height }) {
  const fontSize = (el.size ?? 0.08) * height;
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", alignItems: "center",
      justifyContent: el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center",
      textAlign: el.align || "center", fontSize, fontWeight: el.weight || 700,
      color: el.color || "#fff", fontFamily: el.font || FONT,
      lineHeight: el.lineHeight || 1.05, letterSpacing: el.letterSpacing ? `${el.letterSpacing}em` : "-0.02em",
      fontStyle: el.italic ? "italic" : "normal",
      textDecoration: el.underline ? "underline" : "none",
      textTransform: el.textTransform || "none",
      background: el.bgColor || "transparent",
      borderRadius: el.bgColor ? (el.bgRadius ?? 8) : undefined,
      padding: el.bgColor ? "4px 16px" : undefined,
      overflow: "hidden", whiteSpace: "pre-wrap", textWrap: "balance",
    }}>
      {el.text}
    </div>
  );
}

function IconEl({ el }) {
  const Ico = LucideIcons[el.name] || LucideIcons.Sparkles;
  return <div style={{ width: "100%", height: "100%", color: el.color || "#fff" }}><Ico style={{ width: "100%", height: "100%" }} strokeWidth={1.75} /></div>;
}

function ImageEl({ el }) {
  return el.src ? <Img src={el.src} style={{ width: "100%", height: "100%", objectFit: el.fit || "cover" }} /> : null;
}

function ShapeEl({ el }) {
  return (
    <div style={{
      width: "100%", height: "100%", background: el.fill || "#8b5cf6",
      border: el.stroke ? `${el.strokeWidth ?? 2}px solid ${el.stroke}` : "none",
      borderRadius: el.shape === "ellipse" ? "50%" : (el.radius ?? 8),
    }} />
  );
}

// ── Charts ───────────────────────────────────────────────────────────────

function easeOut(t) { const c = Math.min(1, Math.max(0, t)); return 1 - Math.pow(1 - c, 3); }

function BarChartEl({ el, height }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, frame / fps - (el.startDelay ?? 0));
  const total = el.animationDuration ?? 2.4;
  const rows = Array.isArray(el.rows) ? el.rows : [];
  const axisMax = el.axisMax ?? 100;
  const cardH = el.h * height;
  const titleP = easeOut(Math.min(1, t / (total * 0.15)));

  return (
    <div style={{ width: "100%", height: "100%", background: el.bg ?? "#f5efe6", color: el.fg ?? "#2a1f17", padding: `${cardH * 0.06}px`, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: cardH * 0.02, borderRadius: 6, fontFamily: el.labelFont || FONT, overflow: "hidden" }}>
      {el.title && <div style={{ fontFamily: el.titleFont || "Georgia, serif", fontSize: Math.max(14, cardH * 0.085), fontWeight: 800, lineHeight: 1.1, opacity: titleP, transform: `translateY(${(1 - titleP) * 16}px)` }}>{el.title}</div>}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: cardH * 0.04 }}>
        {rows.map((row, i) => {
          const bStart = total * 0.3 + i * ((total * 0.65) / (rows.length + 1.2) * 0.55);
          const bEnd = bStart + (total * 0.65) / (rows.length + 1.2);
          const p = easeOut(Math.min(1, Math.max(0, (t - bStart) / Math.max(0.001, bEnd - bStart))));
          const val = Math.max(0, Math.min(axisMax, Number(row.value) || 0));
          return (
            <div key={i}>
              <div style={{ fontSize: Math.max(8, cardH * 0.033), fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{row.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: cardH * 0.02, marginTop: 4 }}>
                <div style={{ flex: 1, height: cardH * 0.05, position: "relative" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(val / axisMax) * p * 100}%`, background: el.bar ?? "#d97b1a" }} />
                </div>
                {el.showValues !== false && <div style={{ minWidth: cardH * 0.09, textAlign: "right", fontSize: Math.max(8, cardH * 0.04), fontWeight: 600, opacity: p }}>{Math.round(val * p)}{el.valueSuffix ?? "%"}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineChartEl({ el, height }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = easeOut(Math.min(1, (frame / fps) / (el.animationDuration ?? 1.6)));
  const points = Array.isArray(el.points) ? el.points : [];
  const maxVal = Math.max(...points.map((pt) => Number(pt.value) || 0), 1);
  const cardH = el.h * height;
  const cardW = el.w * height * (16 / 9);
  const pad = { t: 40, b: 30, l: 10, r: 10 };
  const pW = Math.max(1, cardW - pad.l - pad.r);
  const pH = Math.max(1, cardH - pad.t - pad.b);
  const coords = points.map((pt, i) => ({ x: pad.l + (i / Math.max(1, points.length - 1)) * pW, y: pad.t + pH - ((Number(pt.value) || 0) / maxVal) * pH }));
  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const lineColor = el.line || "#34d399";

  return (
    <div style={{ width: "100%", height: "100%", background: el.bg || "rgba(8,10,20,0.6)", borderRadius: 12, padding: 16, boxSizing: "border-box", color: el.fg || "#fff", fontFamily: FONT, position: "relative" }}>
      {el.title && <div style={{ fontSize: Math.max(12, cardH * 0.06), fontWeight: 700, marginBottom: 4 }}>{el.title}</div>}
      <svg width="100%" height="100%" viewBox={`0 0 ${cardW} ${cardH}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        {el.showGrid !== false && [0.25, 0.5, 0.75].map((f) => <line key={f} x1={pad.l} x2={cardW - pad.r} y1={pad.t + pH * (1 - f)} y2={pad.t + pH * (1 - f)} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />)}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={pW * 3} strokeDashoffset={pW * 3 * (1 - p)} />
        {coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={5} fill={lineColor} opacity={easeOut(Math.min(1, Math.max(0, (p - i / points.length) * points.length)))} />)}
      </svg>
      {el.finalValue != null && <div style={{ position: "absolute", right: 20, top: 14, fontSize: Math.max(18, cardH * 0.12), fontWeight: 800, opacity: p, color: lineColor }}>{el.valuePrefix || ""}{Math.round(Number(el.finalValue) * p)}{el.valueSuffix || ""}</div>}
    </div>
  );
}

function StatEl({ el, height }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = easeOut(Math.min(1, (frame / fps) / (el.animationDuration ?? 1.2)));
  const cardH = el.h * height;
  const accent = el.accent || "#fbbf24";
  const value = Number(el.value) || 0;
  const display = el.countUp !== false ? Math.round(value * p) : value;
  const sparkline = Array.isArray(el.sparkline) ? el.sparkline : [];
  const sparkMax = Math.max(...sparkline, 1);

  return (
    <div style={{ width: "100%", height: "100%", background: el.bg || "rgba(8,10,20,0.6)", borderRadius: 16, padding: "5% 8%", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", color: el.fg || "#fff", fontFamily: FONT, position: "relative", overflow: "hidden" }}>
      {sparkline.length > 1 && <svg viewBox={`0 0 ${sparkline.length - 1} ${sparkMax}`} preserveAspectRatio="none" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "40%", opacity: 0.12 }}><polyline points={sparkline.map((v, i) => `${i},${sparkMax - v}`).join(" ")} fill="none" stroke={accent} strokeWidth={0.5} /></svg>}
      {el.label && <div style={{ fontSize: Math.max(10, cardH * 0.06), fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.7, marginBottom: 4 }}>{el.label}</div>}
      <div style={{ fontSize: Math.max(24, cardH * 0.28), fontWeight: 900, opacity: p, color: accent }}>{el.valuePrefix || ""}{display.toLocaleString()}{el.valueSuffix || ""}</div>
      {el.caption && <div style={{ fontSize: Math.max(10, cardH * 0.055), opacity: 0.6, marginTop: 4 }}>{el.caption}</div>}
    </div>
  );
}

function SubtitleEl({ el, height }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const totalSec = (el.duration > 0 ? el.duration : durationInFrames / fps) || 1;
  const sec = frame / fps;
  const fontSize = (el.size ?? 0.07) * height;
  const baseColor = el.color || "#fff";
  const accent = el.accent || "#8b5cf6";
  const future = el.futureOpacity ?? 0.45;

  let timings = [];
  if (Array.isArray(el.wordTimings) && el.wordTimings.length) {
    timings = el.wordTimings.map((w) => ({ word: String(w.word || ""), start: Number(w.start) || 0, end: Number(w.end) || 0 }));
  } else {
    const raw = String(el.text || "").trim();
    if (raw && totalSec > 0) {
      const tokens = raw.split(/\s+/).filter(Boolean);
      const weights = tokens.map((t) => t.replace(/[^\p{L}\p{N}']/gu, "").length + 1);
      const sum = weights.reduce((a, b) => a + b, 0) || tokens.length;
      let cursor = 0;
      timings = tokens.map((word, i) => { const slice = (weights[i] / sum) * totalSec; const start = cursor; cursor += slice; return { word, start, end: cursor }; });
    }
  }

  let ci = -1;
  for (let i = 0; i < timings.length; i++) { if (sec >= timings[i].start && sec < timings[i].end) { ci = i; break; } }
  if (ci === -1 && timings.length && sec >= timings[timings.length - 1].end) ci = timings.length;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: `${fontSize * 0.18}px ${fontSize * 0.35}px`, padding: "8px 16px", background: "rgba(8,10,20,0.55)", borderRadius: 16, fontFamily: el.font || FONT, fontWeight: el.weight || 800, overflow: "hidden" }}>
      {timings.length === 0
        ? <span style={{ color: baseColor, fontSize, opacity: 0.6 }}>{el.text || ""}</span>
        : timings.map((t, i) => (
          <span key={`${t.word}-${i}`} style={{
            display: "inline-block", color: i === ci ? accent : baseColor,
            opacity: i <= ci ? 1 : future, fontSize, lineHeight: 1.15,
            transform: `scale(${i === ci ? 1.1 : 1})`, transformOrigin: "center bottom",
            textShadow: i === ci ? `0 0 18px ${accent}aa` : "none", whiteSpace: "pre",
          }}>{t.word}</span>
        ))
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-TRACK TIMELINE
// ═══════════════════════════════════════════════════════════════════════════

const fStart = (s, fps) => Math.max(0, Math.round((Number(s) || 0) * fps));
const fDur = (s, fps) => Math.max(1, Math.round((Number(s) || 0) * fps));

function TimelineVideo({ timeline, colors }) {
  const { fps } = useVideoConfig();
  const tracks = Array.isArray(timeline.tracks) ? timeline.tracks : [];
  const zoomRegions = Array.isArray(timeline.zoomRegions) ? timeline.zoomRegions : [];
  const visualTracks = tracks.filter((t) => t.kind !== "audio");
  const audioTracks = tracks.filter((t) => t.kind === "audio");

  return (
    <AbsoluteFill style={{ backgroundColor: colors[0] }}>
      <ZoomCamera zoomRegions={zoomRegions} fps={fps}>
        {visualTracks.map((track) =>
          (track.clips ?? []).map((clip, i) => (
            <Sequence key={clip.id ?? `${track.id}-${i}`} from={fStart(clip.start, fps)} durationInFrames={fDur(clip.duration, fps)} layout="none">
              <ClipView clip={clip} colors={colors} index={i} fps={fps} />
            </Sequence>
          ))
        )}
      </ZoomCamera>
      {audioTracks.map((track) =>
        track.muted ? null : (track.clips ?? []).filter((c) => c.src).map((clip, i) => (
          <Sequence key={clip.id ?? `${track.id}-a${i}`} from={fStart(clip.start, fps)} durationInFrames={fDur(clip.duration, fps)}>
            <Audio src={clip.src} startFrom={fStart(clip.trimStart ?? 0, fps)} volume={clip.volume == null ? 1 : clip.volume} />
          </Sequence>
        ))
      )}
    </AbsoluteFill>
  );
}

function ZoomCamera({ zoomRegions, fps, children }) {
  const frame = useCurrentFrame();
  let scale = 1, ox = 50, oy = 50;
  for (const r of zoomRegions) {
    const s = fStart(r.start, fps), e = fStart(r.end, fps);
    if (frame < s || frame > e) continue;
    const span = Math.max(1, e - s), ramp = Math.min(span / 2, Math.round(span * 0.3));
    let p;
    if (frame < s + ramp) p = interpolate(frame, [s, s + ramp], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    else if (frame > e - ramp) p = interpolate(frame, [e - ramp, e], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    else p = 1;
    scale = 1 + (Math.max(1, Math.min(4, Number(r.scale) || 1.4)) - 1) * p;
    ox = (r.x == null ? 0.5 : r.x) * 100;
    oy = (r.y == null ? 0.5 : r.y) * 100;
    break;
  }
  return <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: `${ox}% ${oy}%` }}>{children}</AbsoluteFill>;
}

function ClipView({ clip, colors, index, fps }) {
  if (clip.type === "image" && clip.src) return <AbsoluteFill style={{ backgroundColor: "#000" }}><Img src={clip.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></AbsoluteFill>;
  if (clip.type === "text") {
    const fadeIn = interpolate(useCurrentFrame(), [0, 12], [0, 1], { extrapolateRight: "clamp" });
    return <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "8%" }}><div style={{ opacity: fadeIn, fontSize: 72, fontWeight: 850, letterSpacing: "-0.03em", textAlign: "center", color: "#fff", fontFamily: FONT }}>{clip.text || clip.label || ""}</div></AbsoluteFill>;
  }
  const scene = clip.scene || { text: clip.label || "", animation: clip.animation || "fade-in" };
  return <SceneRenderer scene={scene} colors={colors} index={index} clipDurationInFrames={fDur(clip.duration, fps)} />;
}
