import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Series } from "remotion";

export default function GeneratedVideo() {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const scale = spring({ frame, fps, config: { damping: 14, stiffness: 150, mass: 0.8 } });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a1a", justifyContent: "center", alignItems: "center" }}>
      <div style={{
        opacity,
        transform: `scale(${scale})`,
        textAlign: "center",
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        <div style={{
          fontSize: 64, font