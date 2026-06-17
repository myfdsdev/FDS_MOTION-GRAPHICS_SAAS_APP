import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Series,
  Solid,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  random,
} from "remotion";

const COLORS = {
  background: "#0A0A0F",
  surface: "#161616",
  primaryText: "#FFFFFF",
  secondaryText: "#111111",
  accent: "#D6F54A", // Lime
  accentAlt: "#FF4D8D", // Hot Pink
};

const springConfig = {
  stiffness: 150,
  damping: 15,
};

const Letter: React.FC<{
  char: string;
  delay: number;
  color?: string;
  fontSize: number;
  fontWeight: number;
  initialY?: number;
}> = ({ char, delay, color = COLORS.primaryText, fontSize, fontWeight, initialY = 100 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: springConfig,
  });

  const translateY = interpolate(
    entrance,
    [0, 1],
    [initialY, 0]
  );

  const opacity = interpolate(
    entrance,
    [0, 0.5, 1],
    [0, 0.5, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <span
      style={{
        display: "inline-block",
        transform: `translateY(${translateY}px)`,
        opacity,
        color,
        fontSize,
        fontWeight,
        whiteSpace: "pre", // To preserve spaces between letters
      }}
    >
      {char}
    </span>
  );
};

const UserComposition: React.FC = () => {
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const text = "Remotion!";
  const fontSize = 100;
  const fontWeight = 700;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "row" }}>
        {text.split("").map((char, index) => (
          <Letter
            key={index}
            char={char}
            delay={index * 5} // Stagger delay for each letter
            fontSize={fontSize}
            fontWeight={fontWeight}
            color={index % 2 === 0 ? COLORS.accent : COLORS.accentAlt}
            initialY={150}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export default UserComposition;