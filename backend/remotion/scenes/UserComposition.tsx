import React from "react";
import { AbsoluteFill, Sequence, Series, useCurrentFrame, useVideoConfig,
         interpolate, spring, Easing, random } from "remotion";

export const UserComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // --- Color Palette ---
  const DARK_BROWN = "#2C1A1A"; // Deep espresso
  const MEDIUM_BROWN = "#6F4E37"; // Coffee brown
  const LIGHT_TAN = "#D2B48C"; // Creamy tan
  const ACCENT_ORANGE = "#A0522D"; // Burnt orange / sienna
  const WHITE = "#FFFFFF";

  // --- Background Animation: Drifting Gradients ---
  // Blob 1
  const gradientBlob1Opacity = interpolate(frame, [0, 30, durationInFrames - 30, durationInFrames], [0, 0.5, 0.5, 0], { extrapolateRight: "clamp" });
  const gradientBlob1X = interpolate(frame, [0, durationInFrames], [-200, 1920 + 200], { easing: Easing.linear });
  const gradientBlob1Y = interpolate(frame, [0, durationInFrames], [-200, 1080 + 200], { easing: Easing.linear });
  const gradientBlob1Scale = interpolate(frame, [0, durationInFrames / 2, durationInFrames], [1, 1.2, 1], { easing: Easing.easeInOutSine });

  // Blob 2
  const gradientBlob2Opacity = interpolate(frame, [0, 45, durationInFrames - 45, durationInFrames], [0, 0.4, 0.4, 0], { extrapolateRight: "clamp" });
  const gradientBlob2X = interpolate(frame, [0, durationInFrames], [1920 + 200, -200], { easing: Easing.linear });
  const gradientBlob2Y = interpolate(frame, [0, durationInFrames], [1080 + 200, -200], { easing: Easing.linear });
  const gradientBlob2Scale = interpolate(frame, [0, durationInFrames / 2, durationInFrames], [1.2, 1, 1.2], { easing: Easing.easeInOutSine });

  // --- Scene Durations (in frames) ---
  const SCENE1_START = 0; // BrewLoop Intro
  const SCENE1_DURATION = 60; // 2 seconds

  const SCENE2_START = SCENE1_START + SCENE1_DURATION - 15; // Overlap for soft transition
  const SCENE2_DURATION = 75; // 2.5 seconds (including overlap)

  const SCENE3_START = SCENE2_START + SCENE2_DURATION - 15; // Overlap
  const SCENE3_DURATION = 75; // 2.5 seconds

  const SCENE4_START = SCENE3_START + SCENE3_DURATION - 15; // Overlap
  const SCENE4_DURATION = 60; // 2 seconds

  return (
    <AbsoluteFill style={{ backgroundColor: DARK_BROWN, overflow: 'hidden' }}>
      {/* Background Gradients */}
      <div
        style={{
          position: "absolute",
          width: "1000px",
          height: "1000px",
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 50%, ${ACCENT_ORANGE} 0%, transparent 70%)`, // Example gradient
          opacity: gradientBlob1Opacity,
          transform: `translate(${gradientBlob1X}px, ${gradientBlob1Y}px) scale(${gradientBlob1Scale})`,
          filter: "blur(100px)",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "1200px",
          height: "1200px",
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 50%, ${MEDIUM_BROWN} 0%, transparent 70%)`, // Example gradient
          opacity: gradientBlob2Opacity,
          transform: `translate(${gradientBlob2X}px, ${gradientBlob2Y}px) scale(${gradientBlob2Scale})`,
          filter: "blur(120px)",
          zIndex: 0,
        }}
      />
      {/* Main content will go here */}
    </AbsoluteFill>
  );
};

export default UserComposition;
