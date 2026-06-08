/**
 * PLACEHOLDER — overwritten by the AI pipeline before each render.
 * This file MUST always export a default React component.
 */
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

const Placeholder = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: 32, fontFamily: "Inter, sans-serif" }}>
        Generating video…
      </div>
    </AbsoluteFill>
  );
};

export default Placeholder;
