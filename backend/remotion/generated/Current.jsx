import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Series } from "remotion";

const fps = 30;
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const bgColor = "#09090b";
const surfaceColor = "#18181b";
const accentColor = "#a855f7";
const secondaryColor = "#ec4899";
const textColor = "#fafafa";
const textMutedColor = "#94a3b8";

const font = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// LAYER 1 — ANIMATED BACKGROUND
const AnimatedBackground = ({ frame, durationInFrames, offset = 0 }) => {
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const sinOffset = Math.sin((frame + offset * 10) * 0.03);
  const cosOffset = Math.cos((frame + offset * 10) * 0.025);

  const gradient1X = interpolate(progress, [0, 1], [-20, 120]) + sinOffset * 10;
  const gradient1Y = interpolate(progress, [0, 1], [30, 70]) + cosOffset * 10;

  const gradient2X = interpolate(progress, [0, 1], [120, -20]) + cosOffset * 15;
  const gradient2Y = interpolate(progress, [0, 1], [70, 30]) + sinOffset * 15;

  const gradient3X = 50 + sinOffset * 20;
  const gradient3Y = 50 + cosOffset * 20;

  const orb1X = 10 + Math.sin(frame * 0.02) * 10;
  const orb1Y = 10 + Math.cos(frame * 0.025) * 10;
  const orb2X = 80 + Math.cos(frame * 0.018) * 15;
  const orb2Y = 20 + Math.sin(frame * 0.022) * 15;
  const orb3X = 30 + Math.sin(frame * 0.023) * 12;
  const orb3Y = 90 + Math.cos(frame * 0.019) * 12;
  const orb4X = 60 + Math.cos(frame * 0.02) * 10;
  const orb4Y = 50 + Math.sin(frame * 0.025) * 10;

  const gridPositionX = interpolate(progress, [0, 1], [0, -20], { extrapolateRight: "clamp" });
  const gridPositionY = interpolate(progress, [0, 1], [0, -10], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: bgColor,
      }}
    >
      {/* Gradient Mesh */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: `
            radial-gradient(circle at ${gradient1X}% ${gradient1Y}%, ${accentColor}1A 0%, transparent 50%),
            radial-gradient(circle at ${gradient2X}% ${gradient2Y}%, ${secondaryColor}1A 0%, transparent 50%),
            radial-gradient(circle at ${gradient3X}% ${gradient3Y}%, ${accentColor}10 0%, transparent 50%)
          `,
        }}
      />

      {/* Floating Orbs */}
      {[
        { x: orb1X, y: orb1Y, size: 200, color: accentColor },
        { x: orb2X, y: orb2Y, size: 250, color: secondaryColor },
        { x: orb3X, y: orb3Y, size: 180, color: accentColor },
        { x: orb4X, y: orb4Y, size: 220, color: secondaryColor },
      ].map((orb, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: orb.size,
            height: orb.size,
            borderRadius: "50%",
            background: orb.color,
            filter: "blur(60px)",
            opacity: 0.08 + Math.sin(frame * 0.01 + i) * 0.02,
            transform: `translate(${orb.x}vw, ${orb.y}vh)`,
          }}
        />
      ))}

      {/* Grid/Dot Pattern */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundImage: `radial-gradient(${surfaceColor} 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
          opacity: 0.1,
          transform: `translate(${gridPositionX}px, ${gridPositionY}px)`,
        }}
      />

      {/* Noise Texture */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: `repeating-conic-gradient(from 0deg at 25% 25%, #0000 0.0001%, ${surfaceColor} 0.0002% 0.0003%)`,
          opacity: 0.03,
        }}
      />
    </div>
  );
};

// LAYER 2 — GEOMETRIC DECORATION
const GeometricElements = ({ frame, durationInFrames, offset = 0 }) => {
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });

  const bracketOpacity = interpolate(progress, [0.1, 0.3], [0, 1], { extrapolateRight: "clamp" });
  const bracketScale = interpolate(progress, [0.1, 0.3], [0.5, 1], { extrapolateRight: "clamp" });

  const lineProgress = interpolate(progress, [0.3, 0.6], [0, 1], { extrapolateRight: "clamp" });

  const ringRotate = frame * 0.3 + offset * 10;
  const ringDashOffset = interpolate(progress, [0.2, 0.5], [502, 0], { extrapolateRight: "clamp" });

  const diamondTranslateY = Math.sin((frame + offset * 5) * 0.04) * 15;
  const diamondRotate = frame * 0.5 + offset * 10;

  return (
    <div
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Rotating Ring */}
      <div style={{ position: "absolute", top: "20%", left: "75%", transform: "translate(-50%, -50%)" }}>
        <svg viewBox="0 0 200 200" width="150" height="150">
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke={accentColor}
            strokeWidth="2"
            strokeDasharray="502"
            strokeDashoffset={ringDashOffset}
            transform={`rotate(${ringRotate} 100 100)`}
            style={{ opacity: interpolate(progress, [0, 0.2], [0, 1]) }}
          />
        </svg>
      </div>

      {/* Animated Lines */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "20%",
          width: interpolate(lineProgress, [0, 1], [0, 100]),
          height: 2,
          backgroundColor: secondaryColor,
          opacity: interpolate(lineProgress, [0, 1], [0, 0.6]),
          transform: "translateY(-50%)",
          boxShadow: `0 0 15px ${secondaryColor}88`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          right: "20%",
          width: interpolate(lineProgress, [0, 1], [0, 80]),
          height: 2,
          backgroundColor: accentColor,
          opacity: interpolate(lineProgress, [0, 1], [0, 0.6]),
          transform: "translateY(-50%)",
          boxShadow: `0 0 15px ${accentColor}88`,
        }}
      />

      {/* Corner Brackets */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 40,
          width: 50,
          height: 50,
          borderLeft: `2px solid ${accentColor}`,
          borderTop: `2px solid ${accentColor}`,
          opacity: bracketOpacity,
          transform: `scale(${bracketScale})`,
          transformOrigin: "top left",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 40,
          width: 50,
          height: 50,
          borderRight: `2px solid ${accentColor}`,
          borderBottom: `2px solid ${accentColor}`,
          opacity: bracketOpacity,
          transform: `scale(${bracketScale})`,
          transformOrigin: "bottom right",
        }}
      />

      {/* Floating Diamonds */}
      {[
        { top: "10%", left: "40%", size: 15, delay: 0 },
        { top: "70%", left: "10%", size: 10, delay: 10 },
        { top: "30%", left: "90%", size: 12, delay: 20 },
      ].map((diamond, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: diamond.top,
            left: diamond.left,
            width: diamond.size,
            height: diamond.size,
            backgroundColor: secondaryColor,
            opacity: 0.2,
            transform: `translateY(${diamondTranslateY}px) rotate(${diamondRotate + diamond.delay}deg)`,
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)", // Diamond shape
          }}
        />
      ))}
    </div>
  );
};

// LAYER 6 — PARTICLE SYSTEM
const Particles = ({ frame, durationInFrames, color = textColor }) => {
  const particles = Array.from({ length: 25 }, (_, i) => ({
    x: (i * 37 + 13) % 90 + 5,
    y: (i * 53 + 7) % 90 + 5,
    size: 2 + (i % 4) * 2,
    speed: 0.3 + (i % 5) * 0.2,
    delay: i * 3,
  }));

  return (
    <>
      {particles.map((p, i) => {
        const particleFrame = frame - p.delay;
        if (particleFrame < 0) return null;

        const startFadeIn = 0;
        const endFadeIn = 30;
        const startFadeOut = durationInFrames - 60;
        const endFadeOut = durationInFrames;

        const opacity = interpolate(
          particleFrame,
          [startFadeIn, endFadeIn, startFadeOut, endFadeOut],
          [0, 0.2, 0.2, 0],
          { extrapolateRight: "clamp" }
        );

        const translateY = interpolate(particleFrame, [0, durationInFrames], [0, -durationInFrames * p.speed]);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}vw`,
              top: `${p.y}vh`,
              width: p.size,
              height: p.size,
              borderRadius: p.size % 2 === 0 ? "50%" : "20%", // Mix of circles and soft squares
              backgroundColor: color,
              opacity,
              transform: `translateY(${translateY}px)`,
              filter: `blur(${p.size / 4}px)`,
            }}
          />
        );
      })}
    </>
  );
};

// Custom ease function for spring animations
const customSpringEase = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

export const RemotionVideo = () => {
  const videoConfig = useVideoConfig();
  const { durationInFrames } = videoConfig;

  const sceneDuration = durationInFrames / 4; // 150 frames per scene

  // Cinematic Overlays
  const frame = useCurrentFrame();
  const vignetteOpacity = interpolate(frame, [0, 30, durationInFrames - 30, durationInFrames], [0, 1, 1, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, fontFamily: font, overflow: "hidden" }}>
      {/* Vignette Overlay */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)`,
          opacity: vignetteOpacity,
          zIndex: 1000,
          pointerEvents: "none",
        }}
      />

      {/* Film Grain Overlay */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: `repeating-conic-gradient(from 0deg at 25% 25%, #fff0 0.0001%, #fff 0.0002% 0.0003%)`,
          opacity: 0.02,
          zIndex: 999,
          pointerEvents: "none",
        }}
      />

      <Series>
        {/* Scene 1: Hook Scene - UNLEASH YOUR CONTENT */}
        <Series.Sequence durationInFrames={sceneDuration} name="Hook Scene">
          {(sceneFrame) => {
            const progress = interpolate(sceneFrame, [0, sceneDuration], [0, 1], { extrapolateRight: "clamp" });
            const cameraScale = interpolate(progress, [0, 1], [1, 1.06]);

            // Headline
            const headlineSpring = spring({
              frame: sceneFrame - 15,
              fps,
              config: { damping: 15, stiffness: 150, mass: 0.8 },
              durationInFrames: 30,
            });
            const headlineY = interpolate(headlineSpring, [0, 1], [80, 0]);
            const headlineOpacity = interpolate(headlineSpring, [0, 1], [0, 1]);
            const headlineBlur = interpolate(headlineSpring, [0, 1], [20, 0]);

            // Subtext
            const subtextSpring = spring({
              frame: sceneFrame - 30,
              fps,
              config: { damping: 15, stiffness: 150, mass: 0.8 },
              durationInFrames: 30,
            });
            const subtextY = interpolate(subtextSpring, [0, 1], [40, 0]);
            const subtextOpacity = interpolate(subtextSpring, [0, 1], [0, 1]);
            const subtextBlur = interpolate(subtextSpring, [0, 1], [10, 0]);

            // SVG Illustration (Play Button / Camera)
            const svgSpring = spring({
              frame: sceneFrame - 0,
              fps,
              config: { damping: 15, stiffness: 150, mass: 0.8 },
              durationInFrames: 30,
            });
            const svgScale = interpolate(svgSpring, [0, 1], [0.5, 1]);
            const svgOpacity = interpolate(svgSpring, [0, 1], [0, 1]);
            const svgBlur = interpolate(svgSpring, [0, 1], [20, 0]);

            // SVG path draw for play button
            const pathProgress = interpolate(sceneFrame - 10, [0, 40], [0, 1], { extrapolateRight: "clamp" });
            const pathLength = 600; // Approximate length for the triangle path
            const pathOffset = pathLength * (1 - pathProgress);

            return (
              <AbsoluteFill style={{ transform: `scale(${cameraScale})` }}>
                <AnimatedBackground frame={sceneFrame} durationInFrames={sceneDuration} offset={0} />
                <GeometricElements frame={sceneFrame} durationInFrames={sceneDuration} offset={0} />
                <Particles frame={sceneFrame} durationInFrames={sceneDuration} />

                {/* LAYER 3 — SVG Illustration: Play Button / Camera */}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: `translate(-50%, -50%) scale(${svgScale})`,
                    opacity: svgOpacity,
                    filter: `blur(${svgBlur}px)`,
                    zIndex: 10,
                  }}
                >
                  <svg viewBox="0 0 300 300" width="250" height="250">
                    {/* Outer circle of play button */}
                    <circle cx="150" cy="150" r="120" fill="none" stroke={secondaryColor} strokeWidth="6" />
                    {/* Play triangle */}
                    <path
                      d="M120 100 L200 150 L120 200 Z"
                      fill={accentColor}
                      stroke={accentColor}
                      strokeWidth="2"
                      strokeDasharray={pathLength}
                      strokeDashoffset={pathOffset}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Small camera icon inside */}
                    <rect
                      x="100"
                      y="140"
                      width="100"
                      height="60"
                      rx="10"
                      fill="none"
                      stroke={textColor}
                      strokeWidth="4"
                      opacity={interpolate(svgSpring, [0.5, 1], [0, 1])}
                    />
                    <circle
                      cx="150"
                      cy="170"
                      r="20"
                      fill="none"
                      stroke={textColor}
                      strokeWidth="4"
                      opacity={interpolate(svgSpring, [0.6, 1], [0, 1])}
                    />
                    <circle cx="150" cy="170" r="10" fill={textColor} opacity={interpolate(svgSpring, [0.7, 1], [0, 1])} />
                  </svg>
                </div>

                {/* LAYER 5 — Typography */}
                <div
                  style={{
                    position: "absolute",
                    top: "25%",
                    width: "100%",
                    textAlign: "center",
                    zIndex: 20,
                  }}
                >
                  <h1
                    style={{
                      fontSize: 72,
                      fontWeight: 900,
                      color: textColor,
                      marginBottom: 20,
                      transform: `translateY(${headlineY}px)`,
                      opacity: headlineOpacity,
                      filter: `blur(${headlineBlur}px)`,
                      background: `linear-gradient(45deg, ${accentColor}, ${secondaryColor})`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      textShadow: `0 0 40px ${accentColor}88`,
                    }}
                  >
                    UNLEASH YOUR CONTENT
                  </h1>
                  <p
                    style={{
                      fontSize: 28,
                      fontWeight: 400,
                      color: textMutedColor,
                      transform: `translateY(${subtextY}px)`,
                      opacity: subtextOpacity,
                      filter: `blur(${subtextBlur}px)`,
                    }}
                  >
                    Create 10x more videos, effortlessly.
                  </p>
                </div>
              </AbsoluteFill>
            );
          }}
        </Series.Sequence>

        {/* Scene 2: Feature Scene - STREAMLINE YOUR WORKFLOW */}
        <Series.Sequence durationInFrames={sceneDuration} name="Feature Scene">
          {(sceneFrame) => {
            const progress = interpolate(sceneFrame, [0, sceneDuration], [0, 1], { extrapolateRight: "clamp" });
            const cameraScale = interpolate(progress, [0, 1], [1, 1.06]);

            // Headline
            const headlineSpring = spring({
              frame: sceneFrame - 15,
              fps,
              config: { damping: 15, stiffness: 150, mass: 0.8 },
              durationInFrames: 30,
            });
            const headlineX = interpolate(headlineSpring, [0, 1], [-80, 0]);
            const headlineOpacity = interpolate(headlineSpring, [0, 1], [0, 1]);
            const headlineBlur = interpolate(headlineSpring, [0, 1], [20, 0]);

            // Bullet points
            const bulletSpring = (delay) =>
              spring({
                frame: sceneFrame - delay,
                fps,
                config: { damping: 15, stiffness: 150, mass: 0.8 },
                durationInFrames: 30,
              });
            const bullet1X = interpolate(bulletSpring(30), [0, 1], [-60, 0]);
            const bullet1Opacity = interpolate(bulletSpring(30), [0, 1], [0, 1]);
            const bullet2X = interpolate(bulletSpring(45), [0, 1], [-60, 0]);
            const bullet2Opacity = interpolate(bulletSpring(45), [0, 1], [0, 1]);
            const bullet3X = interpolate(bulletSpring(60), [0, 1], [-60, 0]);
            const bullet3Opacity = interpolate(bulletSpring(60), [0, 1], [0, 1]);

            // SVG Laptop
            const laptopSpring = spring({
              frame: sceneFrame - 20,