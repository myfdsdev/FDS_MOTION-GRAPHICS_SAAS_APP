import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DISPLAY_FONT } from "./fonts";
import { DEFAULT_SCENE_THEME, type SceneTheme, withAlpha } from "./theme";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  /** small uppercase kicker above the title (e.g. "STEP 2") */
  kicker?: string;
  accentColor?: string;
  position?: "top-left" | "bottom-left" | "center";
  theme?: SceneTheme;
}

/**
 * Premium section/chapter title: gradient accent bar draws in, kicker + big
 * headline slide-blur in, optional subtitle. Defaults to a centered full-frame
 * composition (graphics scenes); corner positions remain for footage scenes.
 */
export const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  subtitle,
  kicker,
  accentColor,
  position = "center",
  theme = DEFAULT_SCENE_THEME,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const u = Math.min(width, height) / 1080;

  const accent = accentColor || theme.accent;
  const centered = position === "center";

  const slideIn = spring({ frame, fps, config: { damping: 15, stiffness: 85 } });
  const barIn = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 70 } });
  const subIn = spring({ frame: frame - 8, fps, config: { damping: 20 } });

  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const positionStyles: React.CSSProperties = centered
    ? { justifyContent: "center", alignItems: "center" }
    : position === "bottom-left"
    ? { justifyContent: "flex-end", alignItems: "flex-start", padding: 80 * u }
    : { justifyContent: "flex-start", alignItems: "flex-start", padding: 80 * u };

  return (
    <AbsoluteFill style={{ ...positionStyles, opacity: exit }}>
      <div
        style={{
          textAlign: centered ? "center" : "left",
          maxWidth: centered ? "82%" : "60%",
          opacity: slideIn,
          transform: `translateY(${interpolate(slideIn, [0, 1], [30 * u, 0])}px)`,
          filter: `blur(${interpolate(slideIn, [0, 1], [8, 0])}px)`,
        }}
      >
        {/* Gradient accent bar */}
        <div
          style={{
            width: interpolate(barIn, [0, 1], [0, 92 * u]),
            height: 6 * u,
            borderRadius: 999,
            backgroundImage: `linear-gradient(90deg, ${accent}, ${theme.accent2})`,
            boxShadow: `0 0 ${18 * u}px ${withAlpha(accent, 0.5)}`,
            marginBottom: 22 * u,
            marginLeft: centered ? "auto" : 0,
            marginRight: centered ? "auto" : 0,
          }}
        />

        {kicker ? (
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 700,
              fontSize: 20 * u,
              letterSpacing: "0.38em",
              textTransform: "uppercase",
              color: accent,
              marginBottom: 14 * u,
              textShadow: theme.shadow,
            }}
          >
            {kicker}
          </div>
        ) : null}

        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 700,
            fontSize: (centered ? 66 : 44) * u,
            lineHeight: 1.12,
            color: theme.fg,
            letterSpacing: "0.01em",
            textShadow: theme.shadow,
          }}
        >
          {title}
        </div>

        {subtitle ? (
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 500,
              fontSize: (centered ? 27 : 21) * u,
              marginTop: 14 * u,
              color: theme.muted,
              opacity: subIn,
              transform: `translateY(${interpolate(subIn, [0, 1], [10, 0])}px)`,
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
