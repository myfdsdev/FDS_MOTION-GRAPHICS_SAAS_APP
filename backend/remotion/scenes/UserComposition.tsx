// Placeholder UserComposition. The worker / CLI overwrites this file with the
// AI-generated component before each render. This default just shows a "ready"
// card so the composition is always valid even with no generation yet.

import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const UserComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0a0f 0%, #1a1030 100%)",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ opacity, textAlign: "center" }}>
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-0.03em" }}>
          Ready to generate
        </div>
        <div style={{ fontSize: 28, opacity: 0.6, marginTop: 16 }}>
          Run a prompt to replace this scene.
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default UserComposition;
