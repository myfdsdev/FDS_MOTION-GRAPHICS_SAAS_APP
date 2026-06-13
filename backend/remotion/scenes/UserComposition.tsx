import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

export const UserComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Color Palette
  const primaryRed = "#A01E24"; // Deep, rich red
  const accentTurquoise = "#35858B"; // Vibrant, jewel-like
  const accentSaffron = "#F2C94C"; // Warm, inviting yellow
  const neutralCream = "#F7F4E9"; // Soft background/text color
  const darkContrast = "#1C1C1C"; // For text on light backgrounds

  // --- Scene 1: "Turkey" Title Reveal (0-4s) ---
  const titleIntroDuration = 4 * fps; // 4 seconds
  const turkeyLetters = "TURKEY".split('');
  const letterSprings = turkeyLetters.map((_, i) =>
    spring({
      frame: frame - i * 3, // Staggered entry
      fps,
      config: { damping: 15, stiffness: 200, mass: 0.5 },
      delay: 5
    })
  );

  const titleScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 10, stiffness: 100 },
    delay: 0
  });

  const titleFadeOut = interpolate(
    frame,
    [titleIntroDuration - 30, titleIntroDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // --- Scene 2: "Authentic Turkish Cuisine" (4-10s) ---
  const cuisineIntroDuration = 6 * fps; // 6 seconds
  const cuisineStartFrame = titleIntroDuration;

  const cuisineTextSpring = spring({
    frame: frame - cuisineStartFrame - 15,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.8 },
  });

  const cuisineTextOpacity = interpolate(
    frame,
    [cuisineStartFrame + 15, cuisineStartFrame + 45],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const cuisineTextY = interpolate(cuisineTextSpring, [0, 1], [200, 0]);

  const cuisineBandTranslateX = spring({
    frame: frame - cuisineStartFrame,
    fps,
    config: { damping: 15, stiffness: 150 },
    delay: 0
  });

  const cuisineFadeOut = interpolate(
    frame,
    [cuisineStartFrame + cuisineIntroDuration - 30, cuisineStartFrame + cuisineIntroDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );


  // --- Scene 3: "Vibrant Flavors" - Set Piece (10-16s) ---
  const flavorsIntroDuration = 6 * fps; // 6 seconds
  const flavorsStartFrame = cuisineStartFrame + cuisineIntroDuration;

  const flavorsTextSpring = spring({
    frame: frame - flavorsStartFrame - 15,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.8 },
  });

  const flavorsTextOpacity = interpolate(
    frame,
    [flavorsStartFrame + 15, flavorsStartFrame + 45],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const flavorsTextScale = interpolate(flavorsTextSpring, [0, 1], [0.8, 1]);

  // Abstract food plating elements
  const plateScale = spring({
    frame: frame - flavorsStartFrame - 10,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  const circle1X = interpolate(
    spring({ frame: frame - flavorsStartFrame - 30, fps, config: { damping: 10, stiffness: 100 } }),
    [0, 1],
    [-200, 0]
  );
  const circle1Y = interpolate(
    spring({ frame: frame - flavorsStartFrame - 35, fps, config: { damping: 10, stiffness: 100 } }),
    [0, 1],
    [200, 0]
  );

  const lineProgress1 = interpolate(
    frame - flavorsStartFrame - 40,
    [0, 20],
    [0, 1],
    { easing: Easing.out(Easing.ease) }
  );
  const lineProgress2 = interpolate(
    frame - flavorsStartFrame - 50,
    [0, 20],
    [0, 1],
    { easing: Easing.out(Easing.ease) }
  );

  const patternOpacity = interpolate(
    frame,
    [flavorsStartFrame + 60, flavorsStartFrame + 90],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const flavorsFadeOut = interpolate(
    frame,
    [flavorsStartFrame + flavorsIntroDuration - 30, flavorsStartFrame + flavorsIntroDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // --- Scene 4: Outro - "Experience Turkey" (16-20s) ---
  const outroDuration = 4 * fps; // 4 seconds
  const outroStartFrame = flavorsStartFrame + flavorsIntroDuration;

  const outroTextSpring = spring({
    frame: frame - outroStartFrame - 15,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.8 },
  });

  const outroTextOpacity = interpolate(
    frame,
    [outroStartFrame + 15, outroStartFrame + 45],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const outroTextY = interpolate(outroTextSpring, [0, 1], [100, 0]);

  const outroWordmarkScale = spring({
    frame: frame - outroStartFrame - 0,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: primaryRed, overflow: "hidden" }}>
      {/* Scene 1: "Turkey" Title Reveal */}
      <Sequence from={0} durationInFrames={titleIntroDuration}>
        <AbsoluteFill
          style={{
            backgroundColor: primaryRed,
            justifyContent: "center",
            alignItems: "center",
            opacity: titleFadeOut
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              transform: `scale(${titleScale})`,
              lineHeight: 0.8,
            }}
          >
            {turkeyLetters.map((char, i) => (
              <span
                key={i}
                style={{
                  color: neutralCream,
                  fontSize: "300px",
                  fontWeight: "900",
                  fontFamily: "sans-serif",
                  transform: `translateY(${interpolate(
                    letterSprings[i],
                    [0, 1],
                    [100, 0],
                    { extrapolateLeft: "clamp" }
                  )}px) scale(${interpolate(
                    letterSprings[i],
                    [0, 1],
                    [0.5, 1],
                    { extrapolateLeft: "clamp" }
                  )})`,
                  display: "inline-block", // Required for transform on span
                  opacity: interpolate(
                    letterSprings[i],
                    [0, 0.5],
                    [0, 1],
                    { extrapolateLeft: "clamp" }
                  ),
                }}
              >
                {char}
              </span>
            ))}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: "Authentic Turkish Cuisine" */}
      <Sequence from={cuisineStartFrame} durationInFrames={cuisineIntroDuration}>
        <AbsoluteFill
          style={{
            backgroundColor: accentTurquoise,
            justifyContent: "center",
            alignItems: "center",
            opacity: cuisineFadeOut
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              backgroundColor: primaryRed,
              transform: `translateX(${interpolate(cuisineBandTranslateX, [0, 1], [-1920, 0])}px)`,
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              backgroundColor: accentTurquoise,
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              transform: `translateX(${interpolate(cuisineBandTranslateX, [0, 1], [1920, 0])}px)`,
            }}
          >
            <div
              style={{
                textAlign: "center",
                color: neutralCream,
                fontFamily: "sans-serif",
                fontWeight: "800",
                fontSize: "120px",
                lineHeight: "1.2",
                opacity: cuisineTextOpacity,
                transform: `translateY(${cuisineTextY}px)`,
              }}
            >
              <div>AUTHENTIC</div>
              <div>TURKISH</div>
              <div>CUISINE</div>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: "Vibrant Flavors" - Set Piece */}
      <Sequence from={flavorsStartFrame} durationInFrames={flavorsIntroDuration}>
        <AbsoluteFill
          style={{
            backgroundColor: neutralCream,
            justifyContent: "center",
            alignItems: "center",
            opacity: flavorsFadeOut
          }}
        >
          {/* Abstract Plate */}
          <div
            style={{
              width: "500px",
              height: "500px",
              borderRadius: "50%",
              backgroundColor: "#E0DCD1",
              position: "absolute",
              transform: `scale(${plateScale})`,
              boxShadow: "0 15px 30px rgba(0,0,0,0.1)",
            }}
          />

          {/* Abstract food elements */}
          <div
            style={{
              width: "150px",
              height: "150px",
              borderRadius: "50%",
              backgroundColor: primaryRed,
              position: "absolute",
              top: "calc(50% - 200px)",
              left: "calc(50% - 250px)",
              transform: `translate(${circle1X}px, ${circle1Y}px) scale(${interpolate(plateScale, [0,1],[0.5,1])})`,
              opacity: interpolate(plateScale, [0, 0.5], [0, 1], { extrapolateLeft: "clamp" }),
            }}
          />
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              backgroundColor: accentSaffron,
              position: "absolute",
              top: "calc(50% + 100px)",
              left: "calc(50% + 150px)",
              transform: `translate(${circle1X * -0.5}px, ${circle1Y * 0.8}px) scale(${interpolate(plateScale, [0,1],[0.5,1])})`,
              opacity: interpolate(plateScale, [0, 0.5], [0, 1], { extrapolateLeft: "clamp" }),
            }}
          />
          <div
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              backgroundColor: accentTurquoise,
              position: "absolute",
              top: "calc(50% - 50px)",
              left: "calc(50% + 200px)",
              transform: `translate(${circle1X * 0.3}px, ${circle1Y * -0.6}px) scale(${interpolate(plateScale, [0,1],[0.5,1])})`,
              opacity: interpolate(plateScale, [0, 0.5], [0, 1], { extrapolateLeft: "clamp" }),
            }}
          />

          {/* Decorative lines/patterns */}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1920 1080"
            style={{ position: "absolute", opacity: patternOpacity }}
          >
            <line
              x1="0"
              y1="1080"
              x2={interpolate(lineProgress1, [0, 1], [0, 1920])}
              y2={interpolate(lineProgress1, [0, 1], [1080, 0])}
              stroke={darkContrast}
              strokeWidth="10"
              strokeLinecap="round"
            />
            <line
              x1="1920"
              y1="0"
              x2={interpolate(lineProgress2, [0, 1], [1920, 0])}
              y2={interpolate(lineProgress2, [0, 1], [0, 1080])}
              stroke={primaryRed}
              strokeWidth="10"
              strokeLinecap="round"
            />
          </svg>

          <div
            style={{
              position: "relative",
              zIndex: 1,
              textAlign: "center",
              color: darkContrast,
              fontFamily: "sans-serif",
              fontWeight: "900",
              fontSize: "100px",
              lineHeight: "1.2",
              opacity: flavorsTextOpacity,
              transform: `scale(${flavorsTextScale})`,
              marginTop: "200px", // Position below the abstract plate
            }}
          >
            <div>VIBRANT</div>
            <div>FLAVORS</div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Outro - "Experience Turkey" */}
      <Sequence from={outroStartFrame} durationInFrames={outroDuration}>
        <AbsoluteFill
          style={{
            backgroundColor: darkContrast,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              textAlign: "center",
              color: neutralCream,
              fontFamily: "sans-serif",
              fontWeight: "800",
              fontSize: "120px",
              lineHeight: "1.2",
              marginBottom: "50px",
              opacity: outroTextOpacity,
              transform: `translateY(${outroTextY}px)`,
            }}
          >
            <div>EXPERIENCE</div>
            <div>TURKEY</div>
          </div>
          <div
            style={{
              fontSize: "60px",
              color: accentSaffron,
              fontFamily: "serif",
              fontStyle: "italic",
              fontWeight: "600",
              transform: `scale(${outroWordmarkScale})`,
              opacity: interpolate(outroWordmarkScale, [0.5, 1], [0, 1], { extrapolateLeft: "clamp" }),
            }}
          >
            Your Culinary Journey Awaits
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

export default UserComposition;