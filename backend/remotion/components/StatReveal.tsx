import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DISPLAY_FONT } from "./fonts";
import { DEFAULT_SCENE_THEME, type SceneTheme, withAlpha } from "./theme";

interface StatRevealProps {
  stat: string;
  label?: string;
  accentColor?: string;
  position?: "center" | "bottom-right" | "right";
  theme?: SceneTheme;
}

/** Split "$1,250+" into prefix "$", number 1250, suffix "+", decimals 0. */
function parseStat(stat: string) {
  const m = String(stat).match(/^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/);
  if (!m) return null;
  const num = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  const decimals = (m[2].split(".")[1] || "").length;
  const grouped = m[2].includes(",");
  return { prefix: m[1], value: num, suffix: m[3], decimals, grouped };
}

/**
 * Premium stat: the number COUNTS UP under a spring, wearing the accent
 * gradient with a soft glow halo behind it. Non-numeric stats ("Fast") still
 * work — they spring in whole. Theme-aware and responsive.
 */
export const StatReveal: React.FC<StatRevealProps> = ({
  stat,
  label,
  accentColor,
  position = "center",
  theme = DEFAULT_SCENE_THEME,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const u = Math.min(width, height) / 1080;

  const accent = accentColor || theme.accent;
  const parsed = parseStat(stat);

  const entry = spring({ frame, fps, config: { damping: 12, stiffness: 90, mass: 0.9 } });
  const count = spring({ frame, fps, config: { damping: 30, stiffness: 40 } });
  const labelIn = spring({ frame: frame - 8, fps, config: { damping: 20 } });
  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const display = parsed
    ? `${parsed.prefix}${(parsed.value * count).toLocaleString("en-US", {
        minimumFractionDigits: parsed.decimals,
        maximumFractionDigits: parsed.decimals,
        useGrouping: parsed.grouped,
      })}${parsed.suffix}`
    : stat;

  const positionStyles: React.CSSProperties =
    position === "center"
      ? { justifyContent: "center", alignItems: "center" }
      : position === "right"
      ? { justifyContent: "center", alignItems: "flex-end", paddingRight: 100 * u }
      : { justifyContent: "flex-end", alignItems: "flex-end", padding: 100 * u };

  return (
    <AbsoluteFill style={{ ...positionStyles, opacity: exit }}>
      <div
        style={{
          position: "relative",
          textAlign: position === "center" ? "center" : "right",
          transform: `scale(${interpolate(entry, [0, 1], [0.8, 1])})`,
          opacity: entry,
        }}
      >
        {/* Soft glow halo behind the number */}
        <div
          style={{
            position: "absolute",
            inset: `${-70 * u}px ${-110 * u}px`,
            background: `radial-gradient(ellipse at center, ${withAlpha(accent, 0.22)} 0%, transparent 65%)`,
            filter: `blur(${8 * u}px)`,
          }}
        />

        <div
          style={{
            position: "relative",
            fontFamily: DISPLAY_FONT,
            fontWeight: 700,
            fontSize: 168 * u,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            backgroundImage: `linear-gradient(96deg, ${accent}, ${theme.accent2})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: `drop-shadow(0 ${4 * u}px ${18 * u}px ${withAlpha(accent, 0.35)})`,
          }}
        >
          {display}
        </div>

        {label ? (
          <div
            style={{
              position: "relative",
              fontFamily: DISPLAY_FONT,
              fontWeight: 500,
              fontSize: 27 * u,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: theme.muted,
              marginTop: 20 * u,
              opacity: labelIn,
              transform: `translateY(${interpolate(labelIn, [0, 1], [10, 0])}px)`,
              textShadow: theme.shadow,
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
