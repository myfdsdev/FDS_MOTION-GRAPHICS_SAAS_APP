import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DISPLAY_FONT } from "./fonts";
import { DEFAULT_SCENE_THEME, type SceneTheme, withAlpha } from "./theme";

interface StatCardProps {
  stat: string;
  subtitle?: string;
  accentColor?: string;
  theme?: SceneTheme;
}

/**
 * Premium stat card: big gradient stat inside a glass chip with a glowing
 * accent ring. A true overlay (transparent around the card) — it no longer
 * paints over the whole scene. Theme-aware and responsive.
 */
export const StatCard: React.FC<StatCardProps> = ({
  stat,
  subtitle,
  accentColor,
  theme = DEFAULT_SCENE_THEME,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const u = Math.min(width, height) / 1080;

  const accent = accentColor || theme.accent;

  const cardIn = spring({ frame, fps, config: { damping: 12, stiffness: 110, mass: 0.9 } });
  const subIn = spring({ frame: frame - 8, fps, config: { damping: 20 } });
  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: exit }}>
      <div
        style={{
          textAlign: "center",
          padding: `${56 * u}px ${88 * u}px`,
          borderRadius: 30 * u,
          background: theme.panel,
          border: `1px solid ${withAlpha(accent, 0.35)}`,
          boxShadow: `0 0 ${50 * u}px ${withAlpha(accent, 0.18)}, 0 ${16 * u}px ${50 * u}px rgba(0,0,0,${
            theme.onLight ? 0.10 : 0.4
          })`,
          opacity: cardIn,
          transform: `scale(${interpolate(cardIn, [0, 1], [0.85, 1])})`,
        }}
      >
        <div
          style={{
            fontSize: 130 * u,
            lineHeight: 1.05,
            fontFamily: DISPLAY_FONT,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            backgroundImage: `linear-gradient(96deg, ${accent}, ${theme.accent2})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: `drop-shadow(0 ${3 * u}px ${14 * u}px ${withAlpha(accent, 0.35)})`,
          }}
        >
          {stat}
        </div>
        {subtitle ? (
          <div
            style={{
              opacity: subIn,
              transform: `translateY(${interpolate(subIn, [0, 1], [10, 0])}px)`,
              fontSize: 27 * u,
              color: theme.muted,
              fontFamily: DISPLAY_FONT,
              fontWeight: 500,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginTop: 18 * u,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
