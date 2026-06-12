import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random } from "remotion";

export const UserComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig(); // durationInFrames is 600 (20 seconds * 30 fps)

  // --- Color Palette ---
  const colorDarkBackground = "#0a0a0f";
  const colorPrimaryLightBlue = "#00BCD4"; // Cyan
  const colorSecondaryGreen = "#00E676"; // Light Green
  const colorAccentTeal = "#64FFDA"; // Aqua
  const colorAccentLightGreen = "#A7FFEB"; // Pale Aqua
  const colorTextPrimary = "white";

  // --- Background Animation ---
  const bgTime = frame * 0.05; // Slower time for continuous background movement
  const bgScaleFactor = 0.05; // How much the blobs scale
  const bgRotationSpeed = 0.05; // How fast blobs rotate

  const blob1X = interpolate(Math.sin(bgTime * 0.8), [-1, 1], [-200, 200]);
  const blob1Y = interpolate(Math.cos(bgTime * 0.6), [-1, 1], [-200, 200]); // Fixed: Added closing bracket and output range
  const blob1Scale = 1 + Math.sin(bgTime * 0.5) * bgScaleFactor;
  const blob1Rotate = bgTime * bgRotationSpeed * 10;

  const blob2X = interpolate(Math.cos(bgTime * 0.7), [-1, 1], [-250, 250]);
  const blob2Y = interpolate(Math.sin(bgTime * 0.9), [-1, 1], [-250, 250]);
  const blob2Scale = 1 + Math.cos(bgTime * 0.4) * bgScaleFactor;
  const blob2Rotate = -bgTime * bgRotationSpeed * 12;

  const blob3X = interpolate(Math.sin(bgTime * 0.9), [-1, 1], [-180, 180]);
  const blob3Y = interpolate(Math.cos(bgTime * 0.5), [-1, 1], [-180, 180]);
  const blob3Scale = 1 + Math.sin(bgTime * 0.6) * bgScaleFactor * 0.8;
  const blob3Rotate = bgTime * bgRotationSpeed * 8;

  // --- Text Animations ---
  const fadeInDuration = fps * 1; // 1 second fade in
  const stayDuration = fps * 3; // 3 seconds stay
  const fadeOutDuration = fps * 1; // 1 second fade out

  // Intro text "Welcome to the future"
  const introTextStart = 0;
  const introTextEnd = introTextStart + fadeInDuration + stayDuration + fadeOutDuration;
  const introTextOpacity = interpolate(
    frame,
    [introTextStart, introTextStart + fadeInDuration, introTextStart + fadeInDuration + stayDuration, introTextEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const introTextScale = spring({
    frame: frame - introTextStart,
    fps,
    config: { damping: 200, stiffness: 200 },
    from: 0.8,
    to: 1,
  });

  // Main text "AI-Powered Solutions"
  const mainTextStart = fps * 4; // Starts after intro text fades out
  const mainTextEnd = mainTextStart + fadeInDuration + stayDuration + fadeOutDuration;
  const mainTextOpacity = interpolate(
    frame,
    [mainTextStart, mainTextStart + fadeInDuration, mainTextStart + fadeInDuration + stayDuration, mainTextEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const mainTextScale = spring({
    frame: frame - mainTextStart,
    fps,
    config: { damping: 200, stiffness: 200 },
    from: 0.8,
    to: 1,
  });

  // Sub-text "Innovation at your fingertips"
  const subTextStart = fps * 8; // Starts after main text fades out
  const subTextEnd = subTextStart + fadeInDuration + stayDuration + fadeOutDuration;
  const subTextOpacity = interpolate(
    frame,
    [subTextStart, subTextStart + fadeInDuration, subTextStart + fadeInDuration + stayDuration, subTextEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const subTextScale = spring({
    frame: frame - subTextStart,
    fps,
    config: { damping: 200, stiffness: 200 },
    from: 0.8,
    to: 1,
  });

  // Call to action "Learn More"
  const ctaStart = fps * 12; // Starts after sub-text fades out
  const ctaEnd = ctaStart + fadeInDuration + stayDuration + fadeOutDuration;
  const ctaOpacity = interpolate(
    frame,
    [ctaStart, ctaStart + fadeInDuration, ctaStart + fadeInDuration + stayDuration, ctaEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const ctaScale = spring({
    frame: frame - ctaStart,
    fps,
    config: { damping: 200, stiffness: 200 },
    from: 0.8,
    to: 1,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colorDarkBackground, overflow: "hidden" }}>
      {/* Background Blobs */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          backgroundColor: colorPrimaryLightBlue,
          filter: "blur(80px)",
          opacity: 0.3,
          transform: `translate(-50%, -50%) translate(${blob1X}px, ${blob1Y}px) scale(${blob1Scale}) rotate(${blob1Rotate}deg)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 450,
          height: 450,
          borderRadius: "50%",
          backgroundColor: colorSecondaryGreen,
          filter: "blur(80px)",
          opacity: 0.3,
          transform: `translate(-50%, -50%) translate(${blob2X}px, ${blob2Y}px) scale(${blob2Scale}) rotate(${blob2Rotate}deg)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          backgroundColor: colorAccentTeal,
          filter: "blur(80px)",
          opacity: 0.3,
          transform: `translate(-50%, -50%) translate(${blob3X}px, ${blob3Y}px) scale(${blob3Scale}) rotate(${blob3Rotate}deg)`,
        }}
      />

      {/* Main Content - Centered Text */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          fontFamily: "Arial, sans-serif",
          color: colorTextPrimary,
          textAlign: "center",
          padding: 20,
        }}
      >
        <Sequence from={introTextStart} durationInFrames={introTextEnd - introTextStart}>
          <h1
            style={{
              fontSize: "3.5em",
              fontWeight: "bold",
              marginBottom: "0.5em",
              opacity: introTextOpacity,
              transform: `scale(${introTextScale})`,
              color: colorAccentLightGreen,
            }}
          >
            Welcome to the future
          </h1>
        </Sequence>

        <Sequence from={mainTextStart} durationInFrames={mainTextEnd - mainTextStart}>
          <h2
            style={{
              fontSize: "4.5em",
              fontWeight: "bold",
              marginBottom: "0.5em",
              opacity: mainTextOpacity,
              transform: `scale(${mainTextScale})`,
              color: colorPrimaryLightBlue,
            }}
          >
            AI-Powered Solutions
          </h2>
        </Sequence>

        <Sequence from={subTextStart} durationInFrames={subTextEnd - subTextStart}>
          <p
            style={{
              fontSize: "2.5em",
              marginBottom: "1em",
              opacity: subTextOpacity,
              transform: `scale(${subTextScale})`,
              color: colorAccentTeal,
            }}
          >
            Innovation at your fingertips
          </p>
        </Sequence>

        <Sequence from={ctaStart} durationInFrames={ctaEnd - ctaStart}>
          <button
            style={{
              fontSize: "2em",
              padding: "0.8em 1.5em",
              borderRadius: "50px",
              border: `2px solid ${colorSecondaryGreen}`,
              backgroundColor: "transparent",
              color: colorSecondaryGreen,
              cursor: "pointer",
              transition: "background-color 0.3s ease, color 0.3s ease",
              opacity: ctaOpacity,
              transform: `scale(${ctaScale})`,
              fontWeight: "bold",
            }}
          >
            Learn More
          </button>
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default UserComposition;
