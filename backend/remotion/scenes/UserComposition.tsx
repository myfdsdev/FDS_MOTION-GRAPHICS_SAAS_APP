import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random } from "remotion";

export const UserComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const accentColor = "#00FFFF"; // Electric Blue
  const backgroundColor = "#0A0A0A"; // Dark charcoal
  const textColor = "#FFFFFF"; // White

  // Global background grid effect
  const gridLineOpacity = interpolate(frame, [0, 30, 570, 600], [0, 0.05, 0.05, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gridLineOffset = interpolate(frame, [0, 600], [0, -100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Animated background particles
  const particleCount = 30;
  const particles = Array.from({ length: particleCount }).map((_, i) => {
    const seed = `particle-${i}`;
    const x = random(seed + "x") * width;
    const y = random(seed + "y") * height;
    const size = interpolate(random(seed + "size"), [0, 1], [2, 5]);
    const delay = random(seed + "delay") * 60; // Up to 2 seconds delay
    const startFrame = delay;
    const endFrame = startFrame + 540; // Exist for most of the video

    const opacity = interpolate(frame,
      [startFrame, startFrame + 30, endFrame, endFrame + 30],
      [0, 0.5, 0.5, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const moveX = interpolate(frame, [0, 600], [0, random(seed + "moveX") * 50 - 25]);
    const moveY = interpolate(frame, [0, 600], [0, random(seed + "moveY") * 50 - 25]);

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: x + moveX,
          top: y + moveY,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: accentColor,
          opacity,
          filter: `blur(${size / 4}px)`,
        }}
      />
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* Background Grid */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,${gridLineOpacity}) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,${gridLineOpacity}) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          backgroundPosition: `${gridLineOffset}px ${gridLineOffset}px`,
        }}
      />

      {/* Background Particles */}
      {particles}

      {/* Scene 1: Hook - "Ever Wonder Why...?" (0-3s) */}
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          {["Ever", "Wonder", "Why...?"].map((word, i) => {
            const delay = i * 10;
            const wordSpring = spring({
              frame: frame - delay,
              fps,
              config: { damping: 10, mass: 0.8 },
            });
            const scale = interpolate(wordSpring, [0, 1], [0.5, 1.2]);
            const opacity = interpolate(wordSpring, [0, 0.5], [0, 1]);
            const yOffset = interpolate(wordSpring, [0, 1], [100, 0]);

            return (
              <div
                key={word}
                style={{
                  color: textColor,
                  fontSize: 120 + i * 20, // Make "Why" bigger
                  fontWeight: "900",
                  textTransform: "uppercase",
                  transform: `scale(${scale}) translateY(${yOffset}px)`,
                  opacity,
                  position: "relative",
                  top: i === 0 ? -60 : i === 1 ? -10 : 60, // Stack words vertically
                  letterSpacing: -5,
                }}
              >
                {word}
              </div>
            );
          })}
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Concept 1 - "Your brain is constantly rewriting itself?" (3s-7s) */}
      <Sequence from={90} durationInFrames={120}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          {/* Text */}
          <div
            style={{
              color: textColor,
              fontSize: 80,
              fontWeight: "bold",
              textAlign: "center",
              lineHeight: 1.2,
              padding: "0 100px",
              opacity: spring({ frame: frame - 90, fps, config: { damping: 10, mass: 0.5 } }),
              transform: `translateY(${interpolate(spring({ frame: frame - 90, fps }), [0, 1], [50, 0])}px)`,
            }}
          >
            Your brain is constantly<br />
            rewriting itself?
          </div>

          {/* Neural Network Lines */}
          {Array.from({ length: 15 }).map((_, i) => {
            const lineSeed = `neural-line-${i}`;
            const startX = random(lineSeed + "startX") * width;
            const startY = random(lineSeed + "startY") * height;
            const endX = random(lineSeed + "endX") * width;
            const endY = random(lineSeed + "endY") * height;

            const lineProgress = spring({
              frame: frame - 90 - (i * 5),
              fps,
              config: { damping: 8, mass: 0.8 },
            });
            const lineLength = interpolate(lineProgress, [0, 1], [0, 1]);
            const lineOpacity = interpolate(lineProgress, [0, 0.5], [0, 0.6]);

            // Calculate angle and length for SVG line
            const dx = endX - startX;
            const dy = endY - startY;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: startX,
                  top: startY,
                  width: len * lineLength, // Animate length
                  height: 3,
                  backgroundColor: accentColor,
                  borderRadius: 2,
                  opacity: lineOpacity,
                  transformOrigin: "left center",
                  transform: `rotate(${angle}deg)`,
                  filter: "blur(0.5px)",
                }}
              />
            );
          })}
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Concept 2 - "Learning isn't just absorption, it's connection." (7s-11s) */}
      <Sequence from={210} durationInFrames={120}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          {/* Text */}
          <div
            style={{
              color: textColor,
              fontSize: 70,
              fontWeight: "bold",
              textAlign: "center",
              lineHeight: 1.2,
              padding: "0 100px",
              opacity: spring({ frame: frame - 210, fps, config: { damping: 10, mass: 0.5 } }),
              transform: `translateY(${interpolate(spring({ frame: frame - 210, fps }), [0, 1], [50, 0])}px)`,
            }}
          >
            Learning isn't just absorption,<br />
            it's connection.
          </div>

          {/* Abstract Nodes & Arrows */}
          {[...Array(4)].map((_, i) => {
            const nodeRadius = 50;
            const nodeAngle = (i / 4) * Math.PI * 2 + Math.PI / 4; // Distribute in a circle
            const centerX = width / 2;
            const centerY = height / 2;
            const orbitRadius = 250;

            const nodeX = centerX + orbitRadius * Math.cos(nodeAngle);
            const nodeY = centerY + orbitRadius * Math.sin(nodeAngle);

            const nodeSpring = spring({
              frame: frame - 210 - (i * 10),
              fps,
              config: { damping: 10, mass: 1 },
            });
            const nodeScale = interpolate(nodeSpring, [0, 1], [0.5, 1]);
            const nodeOpacity = interpolate(nodeSpring, [0, 0.5], [0, 1]);

            // Arrow animation
            const nextI = (i + 1) % 4;
            const nextNodeAngle = (nextI / 4) * Math.PI * 2 + Math.PI / 4;
            const nextNodeX = centerX + orbitRadius * Math.cos(nextNodeAngle);
            const nextNodeY = centerY + orbitRadius * Math.sin(nextNodeAngle);

            const arrowProgress = spring({
              frame: frame - 210 - (i * 10) - 15, // Arrows appear slightly after nodes
              fps,
              config: { damping: 8, mass: 0.7 },
            });
            const arrowDraw = interpolate(arrowProgress, [0, 1], [0, 1]);
            const arrowOpacity = interpolate(arrowProgress, [0, 0.5], [0, 0.8]);

            const dX = nextNodeX - nodeX;
            const dY = nextNodeY - nodeY;
            const lineLength = Math.sqrt(dX * dX + dY * dY);
            const lineAngle = Math.atan2(dY, dX) * (180 / Math.PI);

            return (
              <React.Fragment key={`node-${i}`}>
                {/* Node */}
                <div
                  style={{
                    position: "absolute",
                    left: nodeX - nodeRadius / 2,
                    top: nodeY - nodeRadius / 2,
                    width: nodeRadius,
                    height: nodeRadius,
                    borderRadius: "50%",
                    backgroundColor: accentColor,
                    transform: `scale(${nodeScale})`,
                    opacity: nodeOpacity,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: backgroundColor,
                    fontSize: 28,
                    fontWeight: "bold",
                    filter: "blur(0.5px)",
                  }}
                >
                  {i + 1}
                </div>
                {/* Arrow */}
                <div
                  style={{
                    position: "absolute",
                    left: nodeX,
                    top: nodeY,
                    width: lineLength * arrowDraw,
                    height: 5,
                    backgroundColor: accentColor,
                    borderRadius: 2,
                    opacity: arrowOpacity,
                    transformOrigin: "left center",
                    transform: `rotate(${lineAngle}deg)`,
                    filter: "blur(0.5px)",
                  }}
                />
              </React.Fragment>
            );
          })}
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Custom Set-piece - "Tap into new ideas daily." (Cursor Click) (11s-16s) */}
      <Sequence from={330} durationInFrames={150}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          {/* Text */}
          <div
            style={{
              color: textColor,
              fontSize: 90,
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: 100,
              opacity: spring({ frame: frame - 330, fps, config: { damping: 10, mass: 0.5 } }),
              transform: `translateY(${interpolate(spring({ frame: frame - 330, fps }), [0, 1], [50, 0])}px)`,
            }}
          >
            Tap into new ideas daily.
          </div>

          {/* Click Target */}
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: "50%",
              backgroundColor: accentColor,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              transform: `scale(${spring({ frame: frame - 330 - 30, fps, config: { damping: 10, mass: 1 } })})`,
              opacity: spring({ frame: frame - 330 - 30, fps, config: { damping: 10, mass: 1 } }),
              filter: "blur(0.5px)",
              position: "absolute",
              top: height / 2 + 50,
              left: width / 2 - 100,
            }}
          >
            <span style={{ color: backgroundColor, fontSize: 120, fontWeight: "900" }}>?</span>
          </div>

          {/* Animated Cursor */}
          <div
            style={{
              position: "absolute",
              width: 100,
              height: 100,
              transform: `translate(-50%, -50%) rotate(-45deg)`, // Pointing right
              top: interpolate(frame, [330, 330 + 60, 330 + 75], [height / 2 - 100, height / 2 + 50, height / 2 + 50], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.ease),
              }),
              left: interpolate(frame, [330, 330 + 60, 330 + 75], [width / 2 - 200, width / 2, width / 2], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.ease),
              }),
            }}
          >
            <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
              <path
                d="M 10 10 L 90 50 L 10 90 L 20 50 Z"
                fill={textColor}
                stroke={backgroundColor}
                strokeWidth="5"
              />
            </svg>
          </div>

          {/* Click Ripple Effect */}
          {[...Array(3)].map((_, i) => {
            const rippleStartFrame = 330 + 75; // When cursor hits
            const rippleProgress = spring({
              frame: frame - rippleStartFrame - (i * 10),
              fps,
              config: { damping: 8, mass: 0.7 },
            });
            const rippleScale = interpolate(rippleProgress, [0, 1], [0.5, 2.5]);
            const rippleOpacity = interpolate(rippleProgress, [0, 0.8], [0.6, 0]);

            return (
              <div
                key={`ripple-${i}`}
                style={{
                  position: "absolute",
                  width: 200,
                  height: 200,
                  borderRadius: "50%",
                  border: `4px solid ${accentColor}`,
                  transform: `scale(${rippleScale})`,
                  opacity: rippleOpacity,
                  filter: "blur(1px)",
                  top: height / 2 + 50,
                  left: width / 2 - 100,
                }}
              />
            );
          })}
        </AbsoluteFill>
      </Sequence>

      {/* Scene 5: Outro - "Curiosity Fuels Growth." / "Explore. Learn. Thrive." (16s-20s) */}
      <Sequence from={480} durationInFrames={120}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          {/* Main Text */}
          <div
            style={{
              color: textColor,
              fontSize: 100,
              fontWeight: "900",
              textAlign: "center",
              lineHeight: 1.2,
              marginBottom: 40,
              opacity: spring({ frame: frame - 480, fps, config: { damping: 10, mass: 0.5 } }),
              transform: `translateY(${interpolate(spring({ frame: frame - 480, fps }), [0, 1], [50, 0])}px)`,
            }}
          >
            Curiosity Fuels Growth.
          </div>

          {/* Subtitle */}
          <div
            style={{
              color: accentColor,
              fontSize: 50,
              fontWeight: "600",
              textAlign: "center",
              opacity: spring({ frame: frame - 480 - 15, fps, config: { damping: 10, mass: 0.5 } }),
              transform: `translateY(${interpolate(spring({ frame: frame - 480 - 15, fps }), [0, 1], [30, 0])}px)`,
            }}
          >
            Explore. Learn. Thrive.
          </div>

          {/* Accent Color Expansion */}
          <div
            style={{
              position: "absolute",
              width: 0,
              height: 0,
              borderRadius: "50%",
              backgroundColor: accentColor,
              filter: "blur(20px)",
              opacity: interpolate(frame, [480, 510, 570, 600], [0, 0.1, 0.1, 0]),
              transform: `scale(${interpolate(frame, [480, 570], [0.1, 3], { easing: Easing.out(Easing.ease) })})`,
            }}
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

export default UserComposition;