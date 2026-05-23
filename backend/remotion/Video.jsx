import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { getSceneStyle } from "./animations.js";

const DEFAULT_COLORS = ["#0a0a0a", "#8b5cf6"];

export const Video = ({ brandColors, scenes }) => {
  const { fps } = useVideoConfig();
  const colors = Array.isArray(brandColors) && brandColors.length ? brandColors : DEFAULT_COLORS;
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

const Scene = ({ scene, colors, index }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const style = getSceneStyle(scene.animation, frame, fps, durationInFrames);

  const base = colors[0] ?? DEFAULT_COLORS[0];
  const accent = colors[index % Math.max(1, colors.length - 1) + 1] ?? colors[1] ?? DEFAULT_COLORS[1];
  const isPortrait = height > width;
  const fontSize = Math.round(width * (isPortrait ? 0.07 : 0.055));

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 35%, ${accent}33 0%, ${base} 60%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8%",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          width: 90,
          height: 6,
          borderRadius: 6,
          backgroundColor: accent,
          opacity: style.opacity ?? 1,
        }}
      />
      <div
        style={{
          textAlign: "center",
          color: "#ffffff",
          fontSize,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          maxWidth: "90%",
          textWrap: "balance",
          ...style,
        }}
      >
        {scene.text}
      </div>
      {/* Scene index dot */}
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          color: "#ffffff",
          opacity: 0.45,
          fontSize: Math.round(width * 0.018),
          fontWeight: 600,
          letterSpacing: "0.1em",
        }}
      >
        {String(scene.scene ?? index + 1).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};
