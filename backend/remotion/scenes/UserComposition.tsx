import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

// Helper for common text styles
const textStyle: React.CSSProperties = {
  fontFamily: "Arial, sans-serif", // Using a common sans-serif font
  fontWeight: "900", // Extra bold
  textTransform: "lowercase", // All lowercase as per "Lowercase promo" style
  color: "white",
  position: "absolute",
  width: "100%",
  textAlign: "center",
  lineHeight: "1em",
};

// Helper for band styles
const bandStyle: React.CSSProperties = {
  position: "absolute",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const UserComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Scene 1: Food, Fast. (0-45 frames)
  const s1_orangeBandProgress = spring({
    frame: frame - 0,
    fps,
    config: { damping: 15, stiffness: 150 },
  });
  const s1_greenBandProgress = spring({
    frame: frame - 5, // Slightly delayed compared to orange
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s1_textMoveProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s1_textOpacityProgress = spring({
    frame: frame - 25,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s1_textScale = interpolate(s1_textOpacityProgress, [0, 1], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scene 2: Delicious, Delivered. (45-90 frames)
  const s2_blueBandProgress = spring({
    frame: frame - 45,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s2_redBandProgress = spring({
    frame: frame - 50,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s2_textMoveProgress = spring({
    frame: frame - 60,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s2_textOpacityProgress = spring({
    frame: frame - 70,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s2_textScale = interpolate(s2_textOpacityProgress, [0, 1], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scene 3: Your Craving, Covered. (90-135 frames)
  const s3_purpleBandProgress = spring({
    frame: frame - 90,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s3_yellowBandProgress = spring({
    frame: frame - 95,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s3_textMoveProgress = spring({
    frame: frame - 105,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s3_textOpacityProgress = spring({
    frame: frame - 115,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s3_textScale = interpolate(s3_textOpacityProgress, [0, 1], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scene 4: Logo/Call to Action (135-180 frames)
  const s4_logoScale = spring({
    frame: frame - 135,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  const s4_ctaOpacity = spring({
    frame: frame - 150,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const s4_logoRotation = interpolate(frame, [135, 180], [0, 360], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.easeOut,
  });

  const s4_logoColor = interpolate(frame, [135, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const getLogoColor = (progress: number) => {
    const r = interpolate(progress, [0, 1], [255, 0]);
    const g = interpolate(progress, [0, 1], [255, 128]);
    const b = interpolate(progress, [0, 1], [255, 255]);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Scene 1: Food, Fast. */}
      <Sequence from={0} durationInFrames={45}>
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <div
            style={{
              ...bandStyle,
              height: `${interpolate(s1_orangeBandProgress, [0, 1], [0, height * 0.6], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px`,
              backgroundColor: "orange",
              top: 0,
            }}
          />
          <div
            style={{
              ...bandStyle,
              height: `${interpolate(s1_greenBandProgress, [0, 1], [0, height * 0.6], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px`,
              backgroundColor: "limegreen",
              bottom: 0,
            }}
          />
          <div
            style={{
              ...textStyle,
              fontSize: "120px",
              top: "50%",
              transform: `translateY(-50%) translateX(${interpolate(s1_textMoveProgress, [0, 1], [-width / 2, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px) scale(${s1_textScale})`,
              opacity: s1_textOpacityProgress,
              textShadow: "4px 4px 8px rgba(0,0,0,0.5)",
            }}
          >
            food, fast.
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Delicious, Delivered. */}
      <Sequence from={45} durationInFrames={45}>
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <div
            style={{
              ...bandStyle,
              height: `${interpolate(s2_blueBandProgress, [0, 1], [0, height * 0.6], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px`,
              backgroundColor: "deepskyblue",
              top: 0,
            }}
          />
          <div
            style={{
              ...bandStyle,
              height: `${interpolate(s2_redBandProgress, [0, 1], [0, height * 0.6], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px`,
              backgroundColor: "crimson",
              bottom: 0,
            }}
          />
          <div
            style={{
              ...textStyle,
              fontSize: "120px",
              top: "50%",
              transform: `translateY(-50%) translateX(${interpolate(s2_textMoveProgress, [0, 1], [width / 2, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px) scale(${s2_textScale})`,
              opacity: s2_textOpacityProgress,
              textShadow: "4px 4px 8px rgba(0,0,0,0.5)",
            }}
          >
            delicious, delivered.
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Your Craving, Covered. */}
      <Sequence from={90} durationInFrames={45}>
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <div
            style={{
              ...bandStyle,
              height: `${interpolate(s3_purpleBandProgress, [0, 1], [0, height * 0.6], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px`,
              backgroundColor: "rebeccapurple",
              top: 0,
            }}
          />
          <div
            style={{
              ...bandStyle,
              height: `${interpolate(s3_yellowBandProgress, [0, 1], [0, height * 0.6], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px`,
              backgroundColor: "gold",
              bottom: 0,
            }}
          />
          <div
            style={{
              ...textStyle,
              fontSize: "120px",
              top: "50%",
              transform: `translateY(-50%) translateX(${interpolate(s3_textMoveProgress, [0, 1], [-width / 2, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px) scale(${s3_textScale})`,
              opacity: s3_textOpacityProgress,
              textShadow: "4px 4px 8px rgba(0,0,0,0.5)",
            }}
          >
            your craving, covered.
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Logo/Call to Action */}
      <Sequence from={135} durationInFrames={45}>
        <AbsoluteFill
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: "200px",
              fontWeight: "bold",
              color: getLogoColor(s4_logoColor),
              transform: `scale(${s4_logoScale}) rotate(${s4_logoRotation}deg)`,
              opacity: s4_logoScale,
              textShadow: "4px 4px 10px rgba(0,0,0,0.7)",
            }}
          >
            LOGO
          </div>
          <div
            style={{
              ...textStyle,
              fontSize: "60px",
              fontWeight: "normal",
              color: "white",
              bottom: "10%",
              opacity: s4_ctaOpacity,
              transform: `translateY(${interpolate(s4_ctaOpacity, [0, 1], [50, 0])}px)`,
              textShadow: "2px 2px 5px rgba(0,0,0,0.5)",
            }}
          >
            order now at example.com
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

export default UserComposition;