import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DISPLAY_FONT } from "./fonts";
import { DEFAULT_SCENE_THEME, type SceneTheme, withAlpha } from "./theme";

type CalloutType = "info" | "warning" | "tip" | "quote";

interface CalloutBoxProps {
  text: string;
  type?: CalloutType;
  title?: string;
  accentColor?: string;
  theme?: SceneTheme;
}

/** Crisp vector icons (no OS emoji). Stroke color comes from the accent. */
const Icon: React.FC<{ type: CalloutType; size: number; color: string }> = ({
  type,
  size,
  color,
}) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "warning":
      return (
        <svg {...common}>
          <path d="M10.3 3.9 1.8 18.1a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <circle cx="12" cy="17" r="0.5" fill={color} />
        </svg>
      );
    case "tip":
      return (
        <svg {...common}>
          <path d="M9 18h6M10 21h4" />
          <path d="M12 3a6 6 0 0 0-4 10.5c.8.7 1.3 1.5 1.5 2.5h5c.2-1 .7-1.8 1.5-2.5A6 6 0 0 0 12 3Z" />
        </svg>
      );
    case "quote":
      return (
        <svg {...common} fill={color} stroke="none">
          <path d="M10 7H6a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v2a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4V9a2 2 0 0 0 0-2Z" />
          <path d="M20 7h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v2a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4V9a2 2 0 0 0 0-2Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="11" x2="12" y2="16" />
          <circle cx="12" cy="8" r="0.5" fill={color} />
        </svg>
      );
  }
};

/**
 * Premium callout: a glass panel with an accent icon chip and a drawing edge
 * bar. A true overlay — transparent around the card, so the scene shows
 * through. Theme-aware and responsive.
 */
export const CalloutBox: React.FC<CalloutBoxProps> = ({
  text,
  type = "info",
  title,
  accentColor,
  theme = DEFAULT_SCENE_THEME,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const u = Math.min(width, height) / 1080;

  const accent = accentColor || theme.accent;
  const isQuote = type === "quote";

  const cardIn = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const iconIn = spring({ frame: frame - 4, fps, config: { damping: 10, stiffness: 130 } });
  const textIn = spring({ frame: frame - 7, fps, config: { damping: 20 } });
  const barDraw = spring({ frame: frame - 3, fps, config: { damping: 14, stiffness: 80 } });
  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: exit }}>
      <div
        style={{
          width: "72%",
          maxWidth: 1380 * u,
          opacity: cardIn,
          transform: `translateX(${interpolate(cardIn, [0, 1], [-60 * u, 0])}px) scale(${interpolate(
            cardIn,
            [0, 1],
            [0.97, 1],
          )})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 30 * u,
            position: "relative",
            background: theme.panel,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: 22 * u,
            padding: `${42 * u}px ${52 * u}px`,
            overflow: "hidden",
            boxShadow: `0 ${16 * u}px ${50 * u}px rgba(0,0,0,${theme.onLight ? 0.10 : 0.4})`,
          }}
        >
          {/* Accent edge, draws top-to-bottom */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 7 * u,
              height: `${barDraw * 100}%`,
              backgroundImage: `linear-gradient(180deg, ${accent}, ${theme.accent2})`,
              boxShadow: `0 0 ${16 * u}px ${withAlpha(accent, 0.5)}`,
            }}
          />

          {/* Icon chip */}
          <div
            style={{
              flexShrink: 0,
              width: 84 * u,
              height: 84 * u,
              borderRadius: 20 * u,
              background: withAlpha(accent, 0.14),
              border: `1px solid ${withAlpha(accent, 0.35)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: iconIn,
              transform: `scale(${iconIn})`,
            }}
          >
            <Icon type={type} size={44 * u} color={accent} />
          </div>

          {/* Content */}
          <div style={{ flex: 1, opacity: textIn, transform: `translateY(${interpolate(textIn, [0, 1], [10, 0])}px)` }}>
            {title ? (
              <div
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontWeight: 700,
                  fontSize: 34 * u,
                  color: accent,
                  marginBottom: 12 * u,
                  lineHeight: 1.25,
                }}
              >
                {title}
              </div>
            ) : null}
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontWeight: 500,
                fontStyle: isQuote ? "italic" : "normal",
                fontSize: 33 * u,
                color: theme.fg,
                lineHeight: 1.5,
              }}
            >
              {text}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
