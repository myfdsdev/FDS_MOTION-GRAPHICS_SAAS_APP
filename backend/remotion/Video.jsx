import { Lottie } from "@remotion/lottie";
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
  "hero-title",
  "split-lottie-text",
  "dashboard-metrics",
  "feature-cards",
  "cta-end-screen",
];

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

const f = (seconds, fps) => Math.max(1, Math.round((Number(seconds) || 0) * fps));

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
              from={f(clip.start, fps)}
              durationInFrames={f(clip.duration, fps)}
              layout="none"
            >
              <TimelineClipView clip={clip} colors={colors} index={i} fps={fps} />
            </Sequence>
          ))
        )}
      </ZoomCamera>

      {audioTracks.map((track) =>
        (track.clips ?? [])
          .filter((clip) => clip.src)
          .map((clip, i) => (
            <Sequence
              key={clip.id ?? `${track.id}-a${i}`}
              from={f(clip.start, fps)}
              durationInFrames={f(clip.duration, fps)}
            >
              <Audio
                src={clip.src}
                startFrom={f(clip.trimStart ?? 0, fps)}
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
    const start = f(region.start, fps);
    const end = f(region.end, fps);
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
      clipDurationInFrames={f(clip.duration, fps)}
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
  };

  return (
    <AbsoluteFill style={sceneShell(base, accent, secondary, frame, durationInFrames)}>
      <SceneChrome accent={accent} index={index} />
      {template === "split-lottie-text" && <SplitLottieText {...common} />}
      {template === "dashboard-metrics" && <DashboardMetrics {...common} />}
      {template === "feature-cards" && <FeatureCards {...common} />}
      {template === "cta-end-screen" && <CtaEndScreen {...common} />}
      {template === "hero-title" && <HeroTitle {...common} />}
      {!templateFallbacks.includes(template) && <HeroTitle {...common} />}
    </AbsoluteFill>
  );
};

function sceneShell(base, accent, secondary, frame, durationInFrames) {
  const drift = interpolate(frame, [0, durationInFrames], [-24, 24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return {
    overflow: "hidden",
    background:
      `radial-gradient(circle at ${48 + drift / 8}% 34%, ${accent}66 0%, transparent 34%), ` +
      `radial-gradient(circle at ${78 - drift / 12}% 78%, ${secondary}44 0%, transparent 30%), ` +
      `linear-gradient(135deg, ${base} 0%, #0b1020 100%)`,
    color: "#ffffff",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  };
}

function SceneChrome({ accent, index }) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          opacity: 0.28,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "8%",
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
          right: "7%",
          bottom: "8%",
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

function TextStack({ scene, style, align = "left", width = 720, large = false }) {
  const title = scene.headline || scene.text;
  const subtext = scene.subtext || scene.visual;

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
          fontSize: large ? 86 : 68,
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
            fontSize: large ? 30 : 25,
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

function HeroTitle(props) {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "10%" }}>
      <div style={{ position: "absolute", opacity: 0.24, transform: "scale(1.16)" }}>
        <LottiePanel {...props} />
      </div>
      <TextStack scene={props.scene} style={props.style} align="center" width={1120} large />
    </AbsoluteFill>
  );
}

function SplitLottieText(props) {
  return (
    <AbsoluteFill
      style={{
        display: "grid",
        gridTemplateColumns: "0.9fr 1.1fr",
        alignItems: "center",
        gap: 80,
        padding: "8% 9%",
      }}
    >
      <div style={{ transform: "translateY(8px)" }}>
        <LottiePanel {...props} />
      </div>
      <TextStack scene={props.scene} style={props.style} width={780} />
    </AbsoluteFill>
  );
}

function DashboardMetrics(props) {
  const frame = useCurrentFrame();
  const value = Math.round(
    interpolate(frame, [0, props.height > props.width ? 70 : 55], [0, 92], {
      extrapolateRight: "clamp",
    })
  );

  return (
    <AbsoluteFill
      style={{
        display: "grid",
        gridTemplateColumns: "1.05fr 0.95fr",
        alignItems: "center",
        gap: 70,
        padding: "8% 9%",
      }}
    >
      <TextStack scene={props.scene} style={props.style} width={730} />
      <div
        style={{
          borderRadius: 38,
          padding: 34,
          background: "rgba(255,255,255,0.13)",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 36px 90px rgba(0,0,0,0.34)",
        }}
      >
        <LottiePanel {...props} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 24 }}>
          <Metric label="Growth" value={`${value}%`} accent={props.accent} />
          <Metric label="Time saved" value={`${Math.max(1, Math.round(value / 9))}h`} accent={props.secondary} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div
      style={{
        borderRadius: 22,
        padding: 22,
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.14)",
      }}
    >
      <div style={{ fontSize: 19, color: "rgba(255,255,255,0.68)", fontWeight: 650 }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 42, fontWeight: 850, color: accent }}>{value}</div>
    </div>
  );
}

function FeatureCards(props) {
  const frame = useCurrentFrame();
  const animationData =
    props.scene.lottieAnimationData || getLottieAsset(props.scene.lottieAsset)?.animationData;
  const items = [
    props.scene.headline || props.scene.text,
    props.scene.subtext || "Automated motion design",
    props.scene.visual || "Ready for export",
  ];

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "8% 9%" }}>
      <TextStack scene={props.scene} style={props.style} width={1040} />
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
            {animationData ? (
              <div style={{ width: 62, height: 62 }}>
                <Lottie
                  animationData={animationData}
                  loop
                  renderer="svg"
                  style={{ width: 62, height: 62 }}
                />
              </div>
            ) : null}
            <div style={{ marginTop: 24, fontSize: 27, lineHeight: 1.1, fontWeight: 800 }}>
              {item}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function CtaEndScreen(props) {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: "10%",
      }}
    >
      <LottiePanel {...props} />
      <div style={{ marginTop: 42 }}>
        <TextStack scene={props.scene} style={props.style} align="center" width={1100} large />
      </div>
    </AbsoluteFill>
  );
}
