import React from "react";
import { AbsoluteFill, Sequence, Series, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random } from "remotion";

export const UserComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // --- Global Animations & Styles ---

  // Background gradient animation
  const bgHueShift = interpolate(frame, [0, 450], [0, 360], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bgBrightness = interpolate(
    frame,
    [0, 90, 210, 300, 360, 450],
    [0.7, 0.8, 0.6, 0.4, 0.7, 0.8],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const backgroundStyle: React.CSSProperties = {
    background: `radial-gradient(circle at 70% 30%, hsl(${bgHueShift}, 60%, ${bgBrightness * 70}%), hsl(${bgHueShift + 60}, 50%, ${bgBrightness * 20}%))`,
    filter: `brightness(${bgBrightness})`,
    overflow: "hidden",
  };

  // Scanlines / Grid overlay
  const scanlineOpacity = interpolate(
    frame,
    [0, 30, 300, 360, 420, 450],
    [0.1, 0.15, 0.2, 0.05, 0.05, 0.1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const createScanline = (y: number) => (
    <div
      key={y}
      style={{
        position: "absolute",
        left: 0,
        top: y * 2,
        width: "100%",
        height: 1,
        backgroundColor: "rgba(0,0,0,0.2)",
        opacity: scanlineOpacity,
      }}
    />
  );
  const scanlines = Array.from({ length: height / 2 }, (_, i) => createScanline(i));

  // --- Scene 1: PIXEL FORGE Title Reveal (0-3s, 0-90 frames) ---
  const titleSpring = spring({ frame: frame - 15, fps, config: { damping: 15, mass: 0.8, overshootClamping: false } });
  const titleScale = interpolate(titleSpring, [0, 1], [0.5, 1.05]);
  const titleOpacity = interpolate(frame, [0, 30, 80, 90], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const pixelatedText = "PIXEL FORGE".split("").map((char, i) => {
    const charDelay = i * 3; // Stagger each character
    const charSpring = spring({ frame: frame - 15 - charDelay, fps, config: { damping: 10, mass: 0.5 } });
    const charScale = interpolate(charSpring, [0, 1], [0.5, 1]);
    const charTranslateY = interpolate(charSpring, [0, 1], [20, 0]);
    const charOpacity = interpolate(frame - charDelay, [0, 15], [0, 1], { extrapolateLeft: "clamp" });

    return (
      <span
        key={i}
        style={{
          display: "inline-block",
          transform: `scale(${charScale}) translateY(${charTranslateY}px)`,
          opacity: charOpacity,
          margin: "0 8px",
          textShadow: `
            -2px -2px 0 #000,
            2px -2px 0 #000,
            -2px 2px 0 #000,
            2px 2px 0 #000
          `, // Pixel art outline
        }}
      >
        {char}
      </span>
    );
  });

  // --- Scene 2: Retro Elements (3-7s, 90-210 frames) ---
  const elementsOpacity = interpolate(
    frame,
    [90, 120, 190, 210],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const createRetroElement = (seed: string, delay: number, startX: number, startY: number, endX: number, endY: number, size: number, color: string, symbol: string) => {
    const elementSpring = spring({ frame: frame - 90 - delay, fps, config: { damping: 10, mass: 0.5 } });
    const elementScale = interpolate(elementSpring, [0, 1], [0.2, 1]);
    const elementMoveX = interpolate(frame - 90 - delay, [0, 90], [startX, endX], { easing: Easing.easeOutCubic });
    const elementMoveY = interpolate(frame - 90 - delay, [0, 90], [startY, endY], { easing: Easing.easeOutCubic });

    return (
      <div
        key={seed}
        style={{
          position: "absolute",
          left: elementMoveX,
          top: elementMoveY,
          width: size,
          height: size,
          backgroundColor: color,
          opacity: elementsOpacity,
          transform: `scale(${elementScale}) rotate(${interpolate(frame, [0, 450], [0, 360])}deg)`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: size * 0.7,
          fontFamily: "monospace",
          color: "#0a0a1a",
          borderRadius: random(seed) > 0.5 ? "10%" : "50%",
        }}
      >
        {symbol}
      </div>
    );
  };

  const retroElements = [
    createRetroElement("heart", 0, width * 0.2, height * 0.3, width * 0.7, height * 0.4, 80, "#ff60a0", "♥"),
    createRetroElement("coin", 20, width * 0.8, height * 0.6, width * 0.3, height * 0.5, 90, "#f0e050", "$"),
    createRetroElement("star", 40, width * 0.1, height * 0.8, width * 0.6, height * 0.2, 70, "#40e0d0", "★"),
    createRetroElement("up", 60, width * 0.5, height * 0.1, width * 0.2, height * 0.7, 60, "#a050f0", "↑"),
  ];

  // --- Scene 3: Glitch / Game Over (7-11s, 210-330 frames) ---
  const gameOverOpacity = interpolate(
    frame,
    [210, 240, 300, 330],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Glitch effect parameters
  const glitchOffset = interpolate(
    frame,
    [240, 241, 242, 243, 244, 245, 250, 251, 252, 253, 254, 255, 260, 261, 262, 263, 264, 265, 270, 271, 272, 273, 274, 275, 280, 281, 282, 283, 284, 285, 290, 291, 292, 293, 294, 295],
    // FIX: inputRange has 36 elements, outputRange was generating 72 (12 * 6). Changed Array(12) to Array(6) for 6 * 6 = 36 elements.
    Array(6).fill(0).flatMap((_, i) => [
      random(`glitch-${i}-1`) * 20 - 10,
      random(`glitch-${i}-2`) * 20 - 10,
      random(`glitch-${i}-3`) * 20 - 10,
      random(`glitch-${i}-4`) * 20 - 10,
      random(`glitch-${i}-5`) * 20 - 10,
      random(`glitch-${i}-6`) * 20 - 10
    ]),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const glitchHue = interpolate(
    frame,
    [240, 245, 250, 255, 260, 265, 270, 275, 280, 285, 290, 295],
    Array(6).fill(0).flatMap(() => [random("hue1") * 180, random("hue2") * 360]),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const glitchSaturate = interpolate(
    frame,
    [240, 245, 250, 255, 260, 265, 270, 275, 280, 285, 290, 295],
    Array(6).fill(0).flatMap(() => [random("sat1") * 3 + 1, random("sat2") * 2 + 1]),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const glitchScale = interpolate(
    frame,
    [240, 245, 250, 255, 260, 265, 270, 275, 280, 285, 290, 295],
    Array(6).fill(0).flatMap(() => [1 + random("scale1") * 0.1, 1 + random("scale2") * 0.05]),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const gameOverStyle: React.CSSProperties = {
    position: "absolute",
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "monospace",
    fontSize: 150,
    fontWeight: "bold",
    color: "#ff3030",
    textShadow: "8px 8px 0px #000, 16px 16px 0px #800000",
    opacity: gameOverOpacity,
    transform: `translateX(${glitchOffset}px) scale(${glitchScale})`,
    filter: `hue-rotate(${glitchHue}deg) saturate(${glitchSaturate})`,
  };

  const insertCoinText = "INSERT COIN";
  const coinTextOpacity = interpolate(
    frame,
    [260, 270, 290, 300],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const blinkingCoinText = interpolate(frame, [0, 15, 30], [1, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // --- Scene 4: Final Branding & CTA (11-15s, 330-450 frames) ---
  const finalTitleSpring = spring({ frame: frame - 330, fps, config: { damping: 15, mass: 0.8 } });
  const finalTitleScale = interpolate(finalTitleSpring, [0, 1], [0.5, 1]);
  const finalTitleTranslateY = interpolate(finalTitleSpring, [0, 1], [50, 0]);
  const finalTitleOpacity = interpolate(frame, [330, 350], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const ctaSpring = spring({ frame: frame - 350, fps, config: { damping: 10, mass: 0.5 } });
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.7, 1]);
  const ctaTranslateY = interpolate(ctaSpring, [0, 1], [30, 0]);
  const ctaOpacity = interpolate(frame, [350, 370], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Floating particles for outro
  const particles = Array.from({ length: 50 }, (_, i) => {
    const seed = `particle-${i}`;
    const initialX = random(`${seed}-x`) * width;
    const initialY = random(`${seed}-y`) * height;
    const size = random(`${seed}-size`) * 5 + 5;
    const speed = random(`${seed}-speed`) * 0.5 + 0.1;

    const x = interpolate(frame, [330, 450], [initialX, initialX + random(`${seed}-dx`) * 100 - 50], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const y = interpolate(frame, [330, 450], [initialY, initialY - 100 * speed], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const particleOpacity = interpolate(frame, [330, 360, 420, 450], [0, 0.5, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

    return (
      <div
        key={seed}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          backgroundColor: `rgba(255, 255, 255, ${random(`${seed}-color`) * 0.5 + 0.5})`,
          opacity: particleOpacity,
          borderRadius: "50%",
        }}
      />
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      <AbsoluteFill style={backgroundStyle}>
        {scanlines}
        {particles} {/* Particles are continuous but only visible in outro */}

        {/* Scene 1: PIXEL FORGE Title Reveal */}
        <Sequence from={0} durationInFrames={90}>
          <AbsoluteFill
            style={{
              justifyContent: "center",
              alignItems: "center",
              fontFamily: "monospace",
              fontSize: 120,
              fontWeight: "bold",
              color: "#f0e050",
              textTransform: "uppercase",
              transform: `scale(${titleScale})`,
              opacity: titleOpacity,
            }}
          >
            {pixelatedText}
          </AbsoluteFill>
        </Sequence>

        {/* Scene 2: Retro Elements */}
        <Sequence from={90} durationInFrames={120}>
          <AbsoluteFill>
            {retroElements}
          </AbsoluteFill>
        </Sequence>

        {/* Scene 3: Glitch / Game Over */}
        <Sequence from={210} durationInFrames={120}>
          <AbsoluteFill style={gameOverStyle}>
            GAME OVER
            <div
              style={{
                position: "absolute",
                top: height / 2 + 100,
                fontSize: 60,
                color: `rgba(255,255,255,${blinkingCoinText})`,
                opacity: coinTextOpacity,
                textShadow: "4px 4px 0px #000",
              }}
            >
              {insertCoinText}
            </div>
          </AbsoluteFill>
        </Sequence>

        {/* Scene 4: Final Branding & CTA */}
        <Sequence from={330} durationInFrames={120}>
          <AbsoluteFill
            style={{
              justifyContent: "center",
              alignItems: "center",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 120,
                fontWeight: "bold",
                color: "#70f050",
                textTransform: "uppercase",
                textShadow: `
                  -4px -4px 0 #000,
                  4px -4px 0 #000,
                  -4px 4px 0 #000,
                  4px 4px 0 #000
                `,
                transform: `scale(${finalTitleScale}) translateY(${finalTitleTranslateY}px)`,
                opacity: finalTitleOpacity,
              }}
            >
              PIXEL FORGE
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 48,
                color: "#e0e0e0",
                marginTop: 30,
                textShadow: "2px 2px 0px #000",
                transform: `scale(${ctaScale}) translateY(${ctaTranslateY}px)`,
                opacity: ctaOpacity,
              }}
            >
              SUBSCRIBE FOR RETRO ADVENTURES!
            </div>
          </AbsoluteFill>
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default UserComposition;