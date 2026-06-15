import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

const BACKGROUND_COLOR = "#121E2C"; // Dark blue
const MAIN_TEXT_COLOR = "#FFFFFF"; // White
const ACCENT_COLOR_GROWTH = "#00A896"; // Teal-green for growth bars
const ACCENT_COLOR_HIGHLIGHT = "#FFC107"; // Gold for percentages/impact

export const UserComposition: React.FC = () => {
  const videoConfig = useVideoConfig();
  const frame = useCurrentFrame();

  const fps = videoConfig.fps;
  const durationInFrames = videoConfig.durationInFrames; // 600 frames

  // Scene 1: "CONSISTENT GROWTH" Title (Frames 0-120)
  const introDuration = 120;
  const consistentSpring = spring({
    frame: frame - 10, // Start slightly later
    fps,
    config: { damping: 15, mass: 0.8, overshootClamping: false },
  });
  const growthSpring = spring({
    frame: frame - 30, // Start even later
    fps,
    config: { damping: 15, mass: 0.8, overshootClamping: false },
  });
  const introFadeOut = interpolate(frame, [introDuration - 30, introDuration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scene 2: Revenue Bars Animation (Frames 120-360)
  const barsStartFrame = 120;
  const barsDuration = 240; // 360 - 120
  const barData = [
    { label: "Q1", heightRatio: 0.4, value: "+10%" },
    { label: "Q2", heightRatio: 0.6, value: "+15%" },
    { label: "Q3", heightRatio: 0.8, value: "+20%" },
    { label: "Q4", heightRatio: 1.0, value: "+25%" },
  ];
  const maxBarHeight = 400; // Max height for a bar

  // Scene 3: "STRONG PERFORMANCE" with Percentage (Frames 360-500)
  const performanceStartFrame = 360;
  const performanceDuration = 140; // 500 - 360
  const strongSpring = spring({
    frame: frame - (performanceStartFrame + 20),
    fps,
    config: { damping: 12, mass: 0.7 },
  });
  const performanceSpring = spring({
    frame: frame - (performanceStartFrame + 40),
    fps,
    config: { damping: 12, mass: 0.7 },
  });
  const percentageSpring = spring({
    frame: frame - (performanceStartFrame + 80),
    fps,
    config: { damping: 10, mass: 0.6, stiffness: 200 },
  });
  const performanceFadeOut = interpolate(frame, [performanceStartFrame + performanceDuration - 30, performanceStartFrame + performanceDuration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scene 4: Conclusion (Frames 500-600)
  const conclusionStartFrame = 500;
  const conclusionDuration = 100;
  const outroTextSpring = spring({
    frame: frame - (conclusionStartFrame + 30),
    fps,
    config: { damping: 10, mass: 0.8 },
  });
  const outroFadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });


  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND_COLOR, overflow: "hidden" }}>
      {/* Background grid/lines animation (subtle) */}
      <div
        style={{
          position: "absolute",
          width: "200%",
          height: "200%",
          left: "-50%",
          top: "-50%",
          background: `
            repeating-linear-gradient(
              0deg,
              rgba(255,255,255,0.03) 0px,
              rgba(255,255,255,0.03) 1px,
              transparent 1px,
              transparent 40px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(255,255,255,0.03) 0px,
              rgba(255,255,255,0.03) 1px,
              transparent 1px,
              transparent 40px
            )
          `,
          transform: `translate(${interpolate(frame, [0, durationInFrames], [0, -100], { easing: Easing.linear })}px, ${interpolate(frame, [0, durationInFrames], [0, -50], { easing: Easing.linear })}px)`,
          opacity: 0.8,
        }}
      />

      {/* Scene 1: "CONSISTENT GROWTH" Title */}
      <Sequence from={0} durationInFrames={introDuration}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            opacity: introFadeOut,
          }}
        >
          <div
            style={{
              fontSize: 120,
              fontWeight: "900",
              color: MAIN_TEXT_COLOR,
              transform: `scale(${consistentSpring}) translateY(${interpolate(
                consistentSpring,
                [0, 1],
                [-50, 0]
              )}px)`,
              opacity: interpolate(consistentSpring, [0.5, 1], [0, 1]),
              fontFamily: "sans-serif",
              letterSpacing: -5,
              textShadow: "0 0 20px rgba(255,255,255,0.2)",
            }}
          >
            CONSISTENT
          </div>
          <div
            style={{
              fontSize: 150,
              fontWeight: "900",
              color: ACCENT_COLOR_GROWTH,
              transform: `scale(${growthSpring}) translateY(${interpolate(
                growthSpring,
                [0, 1],
                [50, 0]
              )}px)`,
              opacity: interpolate(growthSpring, [0.5, 1], [0, 1]),
              fontFamily: "sans-serif",
              marginTop: -30,
              letterSpacing: -8,
              textShadow: `0 0 20px ${ACCENT_COLOR_GROWTH}80`,
            }}
          >
            GROWTH
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Revenue Bars Animation */}
      <Sequence from={barsStartFrame} durationInFrames={barsDuration}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
            gap: 80,
            transform: `translateY(${interpolate(frame - barsStartFrame, [0, barsDuration - 30], [50, -50], { extrapolateRight: "clamp" })}px)`, // Subtle vertical drift
            opacity: interpolate(frame, [barsStartFrame, barsStartFrame + 30, barsStartFrame + barsDuration - 30, barsStartFrame + barsDuration], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp"
            })
          }}
        >
          {barData.map((data, i) => {
            const barDelay = 15; // Delay in frames for each bar
            const barIntroStart = barsStartFrame + 20 + i * barDelay;
            const barHeightProgress = spring({
              frame: frame - barIntroStart,
              fps,
              config: { damping: 10, mass: 0.5, stiffness: 100 },
            });

            const barHeight = interpolate(
              barHeightProgress,
              [0, 1],
              [0, maxBarHeight * data.heightRatio]
            );

            const valueOpacity = interpolate(
              frame,
              [barIntroStart + 20, barIntroStart + 40],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }
            );

            return (
              <div
                key={data.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    backgroundColor: ACCENT_COLOR_GROWTH,
                    width: 70,
                    height: barHeight,
                    borderRadius: 10,
                    marginBottom: 10,
                    boxShadow: `0 0 20px ${ACCENT_COLOR_GROWTH}80`,
                    transformOrigin: "bottom",
                    transform: `scaleY(${barHeightProgress})`,
                  }}
                />
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: "bold",
                    color: MAIN_TEXT_COLOR,
                    fontFamily: "sans-serif",
                    marginTop: 10,
                  }}
                >
                  {data.label}
                </div>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: "bold",
                    color: ACCENT_COLOR_HIGHLIGHT,
                    fontFamily: "sans-serif",
                    opacity: valueOpacity,
                    marginTop: 5,
                    textShadow: `0 0 10px ${ACCENT_COLOR_HIGHLIGHT}80`,
                  }}
                >
                  {data.value}
                </div>
              </div>
            );
          })}
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: "STRONG PERFORMANCE" with Percentage */}
      <Sequence from={performanceStartFrame} durationInFrames={performanceDuration}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            opacity: performanceFadeOut,
          }}
        >
          <div
            style={{
              fontSize: 100,
              fontWeight: "900",
              color: MAIN_TEXT_COLOR,
              transform: `scale(${strongSpring}) translateY(${interpolate(
                strongSpring,
                [0, 1],
                [-50, 0]
              )}px)`,
              opacity: interpolate(strongSpring, [0.5, 1], [0, 1]),
              fontFamily: "sans-serif",
              letterSpacing: -5,
              textShadow: "0 0 20px rgba(255,255,255,0.2)",
            }}
          >
            STRONG
          </div>
          <div
            style={{
              fontSize: 120,
              fontWeight: "900",
              color: ACCENT_COLOR_HIGHLIGHT,
              transform: `scale(${performanceSpring}) translateY(${interpolate(
                performanceSpring,
                [0, 1],
                [50, 0]
              )}px)`,
              opacity: interpolate(performanceSpring, [0.5, 1], [0, 1]),
              fontFamily: "sans-serif",
              marginTop: -30,
              letterSpacing: -8,
              textShadow: `0 0 20px ${ACCENT_COLOR_HIGHLIGHT}80`,
            }}
          >
            PERFORMANCE
          </div>
          <div
            style={{
              fontSize: 180,
              fontWeight: "900",
              color: ACCENT_COLOR_GROWTH,
              fontFamily: "sans-serif",
              marginTop: 40,
              transform: `scale(${percentageSpring})`,
              opacity: interpolate(percentageSpring, [0.5, 1], [0, 1]),
              textShadow: `0 0 30px ${ACCENT_COLOR_GROWTH}80`,
            }}
          >
            +25%
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Conclusion */}
      <Sequence from={conclusionStartFrame} durationInFrames={conclusionDuration}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            opacity: outroFadeOut,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: "bold",
              color: MAIN_TEXT_COLOR,
              fontFamily: "sans-serif",
              textAlign: "center",
              lineHeight: 1.2,
              transform: `scale(${outroTextSpring})`,
              opacity: interpolate(outroTextSpring, [0.5, 1], [0, 1]),
              textShadow: "0 0 15px rgba(255,255,255,0.2)",
            }}
          >
            DRIVING SUCCESS
            <br />
            TOGETHER
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

export default UserComposition;