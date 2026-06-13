import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random } from "remotion";

export const UserComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // --- Color Palette ---
  const colors = {
    background: "#0A0A1F", // Deep dark blue/purple
    accentBlue: "#5C6BC0", // Calming blue
    accentPurple: "#9575CD", // Soft purple
    lightText: "#FFFFFF",
    mediumText: "#E0E0E0",
    successGreen: "#8BC34A",
  };

  // --- Global Background Animation (Drifting Blobs) ---
  const blob1Offset = interpolate(frame, [0, 600], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blob2Offset = interpolate(frame, [0, 600], [0, -80], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blob3Offset = interpolate(frame, [0, 600], [0, 120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const bgOpacity = interpolate(frame, [570, 600], [1, 0], { extrapolateRight: "clamp" }); // Fade out background at the very end

  // --- Scene 1: Overwhelm (0-4s / 0-120 frames) ---
  const scene1Duration = 120; // 4 seconds
  const overwhelmTextScale = spring({ frame: frame - 15, fps, config: { damping: 200, stiffness: 100 }, durationInFrames: 30 });
  const overwhelmTextOpacity = interpolate(frame, [90, 110], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const chaosWords = ["Distraction", "Tasks", "Emails", "Meetings", "Urgent", "Chaotic"];
  const chaosWordAnimations = chaosWords.map((_, i) => {
    const seed = `chaos-${i}`;
    const startFrame = i * 5;
    const endFrame = scene1Duration - 20;

    const opacity = interpolate(
      frame,
      [startFrame, startFrame + 15, endFrame - 15, endFrame],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const scale = interpolate(
      frame,
      [startFrame, startFrame + 30],
      [0.5, 1],
      { easing: Easing.out(Easing.back(1.7)), extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const xOffset = interpolate(frame, [0, scene1Duration], [random(seed + "x") * 200 - 100, random(seed + "x2") * 200 - 100]);
    const yOffset = interpolate(frame, [0, scene1Duration], [random(seed + "y") * 150 - 75, random(seed + "y2") * 150 - 75]);
    const rotation = interpolate(frame, [0, scene1Duration], [random(seed + "rot") * 30 - 15, random(seed + "rot2") * 30 - 15]);

    return { opacity, scale, xOffset, yOffset, rotation };
  });


  // --- Scene 2: Introducing FlowFocus (4-9s / 120-270 frames) ---
  const scene2Start = 120;
  const scene2Duration = 150; // 5 seconds
  const flowFocusTextScale = spring({
    frame: frame - scene2Start + 15,
    fps,
    config: { damping: 200, stiffness: 100 },
    durationInFrames: 30
  });
  const flowFocusTextOpacity = interpolate(frame, [scene2Start + 120, scene2Start + 140], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, overflow: "hidden" }}>
      {/* Global Background Blobs */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          backgroundColor: colors.accentBlue,
          opacity: bgOpacity * 0.3,
          filter: "blur(80px)",
          transform: `translate(-50%, -50%) translate(${blob1Offset}px, ${blob1Offset}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "70%",
          width: 250,
          height: 250,
          borderRadius: "50%",
          backgroundColor: colors.accentPurple,
          opacity: bgOpacity * 0.3,
          filter: "blur(70px)",
          transform: `translate(-50%, -50%) translate(${blob2Offset}px, ${blob2Offset}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "80%",
          left: "30%",
          width: 350,
          height: 350,
          borderRadius: "50%",
          backgroundColor: colors.accentBlue,
          opacity: bgOpacity * 0.2,
          filter: "blur(90px)",
          transform: `translate(-50%, -50%) translate(${blob3Offset}px, ${blob3Offset}px)`,
        }}
      />

      {/* Scene 1: Overwhelm */}
      <Sequence from={0} durationInFrames={scene1Duration}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <h1
            style={{
              fontFamily: "sans-serif",
              fontSize: 100,
              color: colors.lightText,
              transform: `scale(${overwhelmTextScale})`,
              opacity: overwhelmTextOpacity,
              marginBottom: 50,
            }}
          >
            Overwhelmed?
          </h1>

          {chaosWords.map((word, i) => {
            const anim = chaosWordAnimations[i];
            return (
              <div
                key={word}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: `translate(-50%, -50%) translate(${anim.xOffset}px, ${anim.yOffset}px) scale(${anim.scale}) rotate(${anim.rotation}deg)`,
                  opacity: anim.opacity,
                  color: colors.mediumText,
                  fontSize: 40,
                  fontFamily: "sans-serif",
                  fontWeight: "bold",
                }}
              >
                {word}
              </div>
            );
          })}
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Introducing FlowFocus */}
      <Sequence from={scene2Start} durationInFrames={scene2Duration}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <h1
            style={{
              fontFamily: "sans-serif",
              fontSize: 80,
              color: colors.accentPurple,
              transform: `scale(${flowFocusTextScale})`,
              opacity: flowFocusTextOpacity,
            }}
          >
            Introducing FlowFocus
          </h1>
          <p
            style={{
              fontFamily: "sans-serif",
              fontSize: 30,
              color: colors.lightText,
              opacity: flowFocusTextOpacity,
              marginTop: 20,
            }}
          >
            Your path to clarity.
          </p>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

export default UserComposition;
