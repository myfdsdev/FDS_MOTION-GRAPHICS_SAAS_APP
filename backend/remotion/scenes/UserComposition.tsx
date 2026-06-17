import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { HeroTitle, BarChart, StatReveal, TextCard } from "../components";

export const UserComposition: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const primaryBgColor = "#1A202C"; // Dark blue/charcoal
  const accentColor = "#FF6B35"; // Bright orange
  const textColor = "#FFFFFF"; // White
  const secondaryTextColor = "#A0AEC0"; // Light gray

  // General spring config for elements
  const entranceSpringConfig = { damping: 15, mass: 0.8, stiffness: 100 };

  return (
    <AbsoluteFill style={{ backgroundColor: primaryBgColor }}>
      {/* Scene 1: Hook - "Unlock Your Potential" */}
      <Sequence from={0} durationInFrames={120}>
        <AbsoluteFill style={{ backgroundColor: primaryBgColor }}>
          <HeroTitle
            title="Unlock Your Business Potential"
            subtitle="For Small to Medium Enterprises"
            accentColor={accentColor}
            titleColor={textColor}
            subtitleColor={secondaryTextColor}
            style={{
              // Fade out and scale down for transition
              opacity: interpolate(frame, [90, 120], [1, 0], { extrapolateLeft: "clamp" }),
              transform: `scale(${interpolate(frame, [90, 120], [1, 0.8], { extrapolateLeft: "clamp" })})`,
            }}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Benefits List - Animated Color Bands */}
      <Sequence from={100} durationInFrames={170}> {/* Overlaps with S1 for smooth transition */}
        <AbsoluteFill style={{ backgroundColor: primaryBgColor }}>
          {/* Band 1: Streamline Operations */}
          <div
            style={{
              position: "absolute",
              top: "20%",
              left: 0,
              width: "100%",
              height: "150px",
              backgroundColor: accentColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateX(${interpolate(
                spring({ frame: frame - 120, fps, config: entranceSpringConfig }),
                [0, 1],
                [-1920, 0] // Slide in from left
              )}px)`,
              opacity: interpolate(frame, [120, 150], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            <span
              style={{
                color: primaryBgColor,
                fontSize: "80px",
                fontWeight: "bold",
                fontFamily: "sans-serif",
              }}
            >
              Streamline Operations
            </span>
          </div>

          {/* Band 2: Boost Efficiency */}
          <div
            style={{
              position: "absolute",
              top: "45%",
              left: 0,
              width: "100%",
              height: "150px",
              backgroundColor: textColor, // Use white for contrast
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateX(${interpolate(
                spring({ frame: frame - 150, fps, config: entranceSpringConfig }),
                [0, 1],
                [1920, 0] // Slide in from right
              )}px)`,
              opacity: interpolate(frame, [150, 180], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            <span
              style={{
                color: primaryBgColor,
                fontSize: "80px",
                fontWeight: "bold",
                fontFamily: "sans-serif",
              }}
            >
              Boost Efficiency
            </span>
          </div>

          {/* Band 3: Accelerate Growth */}
          <div
            style={{
              position: "absolute",
              top: "70%",
              left: 0,
              width: "100%",
              height: "150px",
              backgroundColor: accentColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateX(${interpolate(
                spring({ frame: frame - 180, fps, config: entranceSpringConfig }),
                [0, 1],
                [-1920, 0] // Slide in from left
              )}px)`,
              opacity: interpolate(frame, [180, 210], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            <span
              style={{
                color: primaryBgColor,
                fontSize: "80px",
                fontWeight: "bold",
                fontFamily: "sans-serif",
              }}
            >
              Accelerate Growth
            </span>
          </div>

          {/* Transition out for bands: slide all off to the right */}
          <AbsoluteFill
            style={{
              transform: `translateX(${interpolate(
                frame,
                [250, 270],
                [0, 1920],
                { extrapolateLeft: "clamp", easing: Easing.in(Easing.ease) }
              )}px)`,
            }}
          >
            {/* Re-render bands for exit animation */}
            <div style={{ ...bandStyle, top: "20%", backgroundColor: accentColor }}>
              <span style={bandTextStyle}>Streamline Operations</span>
            </div>
            <div style={{ ...bandStyle, top: "45%", backgroundColor: textColor }}>
              <span style={bandTextStyle}>Boost Efficiency</span>
            </div>
            <div style={{ ...bandStyle, top: "70%", backgroundColor: accentColor }}>
              <span style={bandTextStyle}>Accelerate Growth</span>
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Set-Piece - Growth Visualization (BarChart + StatReveal) */}
      <Sequence from={250} durationInFrames={230}> {/* Overlaps with S2 */}
        <AbsoluteFill style={{ backgroundColor: primaryBgColor }}>
          <AbsoluteFill
            style={{
              opacity: interpolate(frame, [250, 270], [0, 1], { extrapolateLeft: "clamp" }),
            }}
          >
            <BarChart
              title="Year-over-Year Growth"
              data={[
                { label: "Q1", value: 30 },
                { label: "Q2", value: 55 },
                { label: "Q3", value: 70 },
                { label: "Q4", value: 90 },
              ]}
              colors={[accentColor, secondaryTextColor, textColor]}
              animationStyle="grow-up"
              showGrid
              showValues
            />

            <StatReveal
              stat="90%"
              label="Growth Achieved"
              accentColor={accentColor}
              position="bottom-right"
              style={{
                opacity: interpolate(frame, [330, 360], [0, 1], { extrapolateLeft: "clamp" }),
                transform: `translateY(${interpolate(
                  spring({ frame: frame - 330, fps, config: entranceSpringConfig }),
                  [0, 1],
                  [50, 0]
                )}px)`,
              }}
            />

            {/* Transition out for BarChart scene: fade out */}
            <AbsoluteFill
              style={{
                opacity: interpolate(frame, [460, 480], [1, 0], { extrapolateLeft: "clamp" }),
              }}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Call to Action */}
      <Sequence from={460} durationInFrames={140}> {/* Overlaps with S3 */}
        <AbsoluteFill style={{ backgroundColor: accentColor }}>
          <AbsoluteFill
            style={{
              opacity: interpolate(frame, [460, 480], [0, 1], { extrapolateLeft: "clamp" }),
            }}
          >
            <TextCard
              text="Ready to Scale? Connect with Us!"
              fontSize={90}
              color={primaryBgColor}
              backgroundColor={accentColor}
              style={{
                opacity: interpolate(frame, [480, 510], [0, 1], { extrapolateLeft: "clamp" }),
                transform: `scale(${spring({ frame: frame - 480, fps, config: entranceSpringConfig })})`,
              }}
            />
            {/* Final fade to black */}
            <AbsoluteFill
              style={{
                backgroundColor: "black",
                opacity: interpolate(frame, [580, 600], [0, 1], { extrapolateLeft: "clamp" }),
              }}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

// Helper styles for band re-rendering in exit transition
const bandStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  width: "100%",
  height: "150px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const bandTextStyle: React.CSSProperties = {
  color: "#1A202C",
  fontSize: "80px",
  fontWeight: "bold",
  fontFamily: "sans-serif",
};

export default UserComposition;