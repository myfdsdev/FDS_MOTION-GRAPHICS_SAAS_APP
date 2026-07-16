import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DISPLAY_FONT } from "./fonts";
import { DEFAULT_SCENE_THEME, type SceneTheme, withAlpha } from "./theme";

interface TextCardProps {
  text: string;
  /** small uppercase label above the statement */
  label?: string;
  fontSize?: number;
  color?: string;
  theme?: SceneTheme;
}

/**
 * Premium statement card: a glass panel with a gradient edge that springs in
 * and carries one big line of copy. A true overlay — it no longer paints over
 * the whole scene, so the scene background (color or footage) stays visible.
 */
export const TextCard: React.FC<TextCardProps> = ({
  text,
  label,
  fontSize,
  color,
  theme = DEFAULT_SCENE_THEME,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const u = Math.min(width, height) / 1080;

  const cardIn = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });
  const textIn = spring({ frame: frame - 5, fps, config: { damping: 18 } });
  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: exit }}>
      <div
        style={{
          position: "relative",
          maxWidth: "76%",
          opacity: cardIn,
          transform: `translateY(${interpolate(cardIn, [0, 1], [36 * u, 0])}px) scale(${interpolate(
            cardIn,
            [0, 1],
            [0.96, 1],
          )})`,
          filter: `blur(${interpolate(cardIn, [0, 1], [6, 0])}px)`,
        }}
      >
        {/* Glass panel */}
        <div
          style={{
            background: theme.panel,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: 26 * u,
            padding: `${52 * u}px ${64 * u}px`,
            boxShadow: `0 ${18 * u}px ${60 * u}px rgba(0,0,0,${theme.onLight ? 0.10 : 0.4})`,
            overflow: "hidden",
          }}
        >
          {/* Gradient top edge */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 6 * u,
              backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`,
              transform: `scaleX(${cardIn})`,
              transformOrigin: "left",
              boxShadow: `0 0 ${20 * u}px ${withAlpha(theme.accent, 0.5)}`,
            }}
          />

          {label ? (
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontWeight: 700,
                fontSize: 19 * u,
                letterSpacing: "0.36em",
                textTransform: "uppercase",
                color: theme.accent,
                marginBottom: 18 * u,
                opacity: textIn,
              }}
            >
              {label}
            </div>
          ) : null}

          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 500,
              fontSize: (fontSize ? fontSize * u : 46 * u),
              lineHeight: 1.32,
              color: color || theme.fg,
              opacity: textIn,
              transform: `translateY(${interpolate(textIn, [0, 1], [12, 0])}px)`,
            }}
          >
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
