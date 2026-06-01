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

const DEFAULT_COLORS = ["#0f172a", "#8b5cf6", "#38bdf8", "#34d399"];

const templateFallbacks = [
  "kinetic-title",
  "animated-bg-text",
  "app-showcase",
  "offer-burst",
  "proof-cards",
  "final-cta",
];

// ---------------------------------------------------------------------------
// Deterministic per-scene layout variation. Same seed -> same result, so a
// re-render of the same scene looks identical, but each scene in a video gets
// a different layout/chrome/background so videos stop looking templated.
// ---------------------------------------------------------------------------

const BG_VARIANTS = ["radial-glow", "diagonal", "corner-spotlight"];
const CORNERS = ["tl", "tr", "bl", "br"];
const GRID_SIZES = [0, 72, 96];
const ALIGNS = ["left", "center"];
const SIZE_SCALES = [0.95, 1.0, 1.1];

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function pickSceneVariant(scene, index) {
  const seed = hashStr(`${index}|${scene?.text || scene?.headline || ""}`);
  const bg = BG_VARIANTS[seed % BG_VARIANTS.length];
  const flip = ((seed >> 2) & 1) === 1;
  const accentCorner = CORNERS[(seed >> 4) % CORNERS.length];
  const numberCandidates = CORNERS.filter((c) => c !== accentCorner);
  const numberCorner = numberCandidates[(seed >> 6) % numberCandidates.length];
  const gridSize = GRID_SIZES[(seed >> 8) % GRID_SIZES.length];
  const align = ALIGNS[(seed >> 10) % ALIGNS.length];
  const sizeScale = SIZE_SCALES[(seed >> 12) % SIZE_SCALES.length];
  return { bg, flip, accentCorner, numberCorner, gridSize, align, sizeScale };
}

const CORNER_POS = {
  tl: { top: "10%", left: "8%" },
  tr: { top: "10%", right: "8%" },
  bl: { bottom: "10%", left: "8%" },
  br: { bottom: "10%", right: "8%" },
};

export const Video = ({ brandColors, scenes, timeline }) => {
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
            <Scene scene={scene} colors={colors} index={i} />
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

const Scene = ({ scene, colors, index, clipDurationInFrames }) => {
  const frame = useCurrentFrame();
  const cfg = useVideoConfig();
  const { fps, width, height } = cfg;
  const durationInFrames = clipDurationInFrames ?? cfg.durationInFrames;
  const style = getSceneStyle(scene.animation, frame, fps, durationInFrames);
  const template = scene.sceneTemplate || templateFallbacks[index % templateFallbacks.length];

  const base = colors[0] ?? DEFAULT_COLORS[0];
  const accent = colors[(index % Math.max(1, colors.length - 1)) + 1] ?? colors[1] ?? DEFAULT_COLORS[1];
  const secondary = colors[(index + 2) % colors.length] ?? DEFAULT_COLORS[2];
  const variant = pickSceneVariant(scene, index);

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

  return (
    <AbsoluteFill style={sceneShell(base, accent, secondary, frame, durationInFrames, variant)}>
      <SceneChrome accent={accent} index={index} variant={variant} />
      <MotionBackdrop accent={accent} secondary={secondary} frame={frame} durationInFrames={durationInFrames} />

      {/* BASE layer — the template draws its own design. Never removed. */}
      {template === "kinetic-title" && <KineticTitle {...common} />}
      {template === "animated-bg-text" && <AnimatedBgText {...common} />}
      {template === "app-showcase" && <AppShowcase {...common} />}
      {template === "offer-burst" && <OfferBurst {...common} />}
      {template === "proof-cards" && <ProofCards {...common} />}
      {template === "final-cta" && <FinalCta {...common} />}
      {!templateFallbacks.includes(template) && <KineticTitle {...common} />}

      {/* FOREGROUND layer — user-placed elements render on top of the template. */}
      {hasElements && (
        <ElementsLayer elements={scene.elements} width={width} height={height} style={style} />
      )}
    </AbsoluteFill>
  );
};

// Renders direct-manipulation elements at their fractional positions. Mirrors
// client/src/components/canvas/Canvas.tsx exactly so a drag in the editor lands
// in the same spot in the MP4.
function ElementsLayer({ elements, width, height }) {
  const ordered = [...elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  // No entrance transform here — elements sit at exact fractional positions so
  // the render matches the editor canvas pixel-for-pixel.
  return (
    <AbsoluteFill>
      {ordered.map((el) => {
        const box = {
          position: "absolute",
          left: el.x * width,
          top: el.y * height,
          width: el.w * width,
          height: el.h * height,
          transform: `rotate(${el.rotation || 0}deg)`,
          transformOrigin: "center",
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
  const title = scene.headline || scene.text || "Your idea in motion";
  const subtext = scene.subtext || scene.visual || "";
  return { title, subtext };
}

function reveal(frame, start, duration = 16) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
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
