import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DISPLAY_FONT } from "./fonts";
import { DEFAULT_SCENE_THEME, type SceneTheme, withAlpha } from "./theme";

interface HeroTitleProps {
  title: string;
  subtitle?: string;
  /** small uppercase line above the title */
  kicker?: string;
  theme?: SceneTheme;
}

/**
 * Premium hero title: staggered WORD reveal (spring + blur), the first word in
 * an accent gradient, a sweeping gradient underline and a letter-spaced
 * subtitle. Fully theme-aware and responsive to the canvas size.
 */
export const HeroTitle: React.FC<HeroTitleProps> = ({
  title,
  subtitle,
  kicker,
  theme = DEFAULT_SCENE_THEME,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const u = Math.min(width, height) / 1080; // responsive unit

  const words = title.trim().split(/\s+/);

  // Exit fade so the title never gets chopped by a scene cut.
  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const kickerIn = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const lineIn = spring({
    frame: frame - words.length * 3 - 2,
    fps,
    config: { damping: 16, stiffness: 70 },
  });
  const subIn = spring({
    frame: frame - words.length * 3 - 6,
    fps,
    config: { damping: 20 },
  });

  const gradient = `linear-gradient(92deg, ${theme.accent}, ${theme.accent2})`;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: exit }}>
      <div style={{ textAlign: "center", maxWidth: "86%" }}>
        {kicker ? (
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 700,
              fontSize: 22 * u,
              letterSpacing: "0.42em",
              textTransform: "uppercase",
              color: theme.accent,
              opacity: kickerIn,
              transform: `translateY(${interpolate(kickerIn, [0, 1], [14, 0])}px)`,
              marginBottom: 26 * u,
              textShadow: theme.shadow,
            }}
          >
            {kicker}
          </div>
        ) : null}

        {/* Word-by-word reveal; the FIRST word carries the accent gradient. */}
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 700,
            fontSize: 96 * u,
            lineHeight: 1.08,
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            columnGap: "0.28em",
            rowGap: 6 * u,
          }}
        >
          {words.map((word, i) => {
            const s = spring({
              frame: frame - i * 3,
              fps,
              config: { damping: 14, stiffness: 110 },
            });
            const isAccent = i === 0 && words.length > 1;
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: s,
                  transform: `translateY(${interpolate(s, [0, 1], [44 * u, 0])}px)`,
                  filter: `blur(${interpolate(s, [0, 1], [10, 0])}px)`,
                  ...(isAccent
                    ? {
                        backgroundImage: gradient,
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                      }
                    : {
                        color: theme.fg,
                        textShadow: theme.shadow,
                      }),
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Sweeping gradient underline */}
        <div
          style={{
            margin: `${30 * u}px auto 0`,
            height: 5 * u,
            width: interpolate(lineIn, [0, 1], [0, 380 * u]),
            borderRadius: 999,
            backgroundImage: gradient,
            boxShadow: `0 0 ${24 * u}px ${withAlpha(theme.accent, 0.55)}`,
          }}
        />

        {subtitle ? (
          <div
            style={{
              marginTop: 26 * u,
              fontFamily: DISPLAY_FONT,
              fontWeight: 500,
              fontSize: 27 * u,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: theme.muted,
              opacity: subIn,
              transform: `translateY(${interpolate(subIn, [0, 1], [12, 0])}px)`,
              textShadow: theme.shadow,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
