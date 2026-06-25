import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * LogoReveal — an animated brand end-card. Premium, self-contained.
 *
 * The logomark (a 4-point sparkle) draws + springs in with a rotating settle and
 * a soft glow pulse, a thin ring sweeps around it, then the wordmark reveals
 * character-by-character with a tagline and an optional CTA chip. Paints its own
 * gradient backdrop + grain + vignette so a single overlay = a full end scene.
 */

interface LogoRevealProps {
  brand?: string;
  tagline?: string;
  cta?: string;
  gradient?: [string, string];
  bg?: string;
  accent?: string;
}

const FONT = "'Space Grotesk', 'Clash Display', Inter, system-ui, sans-serif";
const SPARKLE = "M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2z";

export const LogoReveal: React.FC<LogoRevealProps> = ({
  brand = "MOSAIC MOTION",
  tagline = "WORDS INTO MOTION",
  cta,
  gradient = ["#22D3EE", "#A78BFA"],
  bg = "#0A0A14",
  accent = "#A78BFA",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const [gFrom, gTo] = gradient;

  // Mark: spring scale + rotate settle, continuous gentle twinkle, glow pulse.
  const markIn = spring({ frame, fps, config: { damping: 11, stiffness: 120 } });
  const markScale = interpolate(markIn, [0, 1], [0, 1]);
  const markRot = interpolate(markIn, [0, 1], [-120, 0]);
  const twinkle = 1 + Math.sin(frame / 9) * 0.04;
  const glow = 18 + (Math.sin(frame / 12) + 1) * 14;

  // Ring sweep around the mark.
  const ring = spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 80 } });
  const ringCirc = 2 * Math.PI * 92;

  // Wordmark stagger (starts after the mark lands).
  const chars = brand.split("");
  const wordStart = 18;

  // Tagline + CTA.
  const tagIn = spring({ frame: frame - (wordStart + chars.length * 1.4 + 4), fps, config: { damping: 24 } });
  const ctaIn = spring({ frame: frame - (wordStart + chars.length * 1.4 + 14), fps, config: { damping: 18, stiffness: 120 } });

  const sceneScale = interpolate(spring({ frame, fps, config: { damping: 30 } }), [0, 1], [1.06, 1]);
  const outOpacity = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const markPx = Math.min(150, width / 9);

  return (
    <AbsoluteFill style={{ backgroundColor: bg, opacity: outOpacity, overflow: "hidden" }}>
      {/* gradient mesh backdrop */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(45% 55% at 50% 32%, ${gFrom}33 0%, transparent 60%),
            radial-gradient(50% 55% at 50% 78%, ${gTo}30 0%, transparent 62%)
          `,
        }}
      />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: `scale(${sceneScale})` }}>
        <div style={{ textAlign: "center" }}>
          {/* logomark + ring */}
          <div style={{ position: "relative", width: markPx * 1.9, height: markPx * 1.9, margin: "0 auto 14px" }}>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 200 200"
              style={{ position: "absolute", inset: 0 }}
            >
              <defs>
                <linearGradient id="lr-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={gFrom} />
                  <stop offset="100%" stopColor={gTo} />
                </linearGradient>
              </defs>
              {/* sweeping ring */}
              <circle
                cx="100"
                cy="100"
                r="92"
                fill="none"
                stroke="url(#lr-grad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={ringCirc}
                strokeDashoffset={interpolate(ring, [0, 1], [ringCirc, 0])}
                transform="rotate(-90 100 100)"
                opacity={0.7 * ring}
              />
            </svg>
            {/* sparkle mark */}
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 24 24"
              style={{
                position: "absolute",
                inset: 0,
                transform: `scale(${markScale * twinkle}) rotate(${markRot}deg)`,
                filter: `drop-shadow(0 0 ${glow}px ${accent})`,
              }}
            >
              <defs>
                <linearGradient id="lr-mark" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={gFrom} />
                  <stop offset="100%" stopColor={gTo} />
                </linearGradient>
              </defs>
              <path d={SPARKLE} fill="url(#lr-mark)" />
            </svg>
          </div>

          {/* wordmark */}
          <div
            style={{
              fontSize: Math.min(72, width / 18),
              fontWeight: 800,
              fontFamily: FONT,
              letterSpacing: "0.04em",
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {chars.map((c, i) => {
              const s = spring({ frame: frame - wordStart - i * 1.4, fps, config: { damping: 14, stiffness: 160 } });
              const t = chars.length > 1 ? i / (chars.length - 1) : 0;
              const col = i === 0 ? gFrom : gTo;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    whiteSpace: c === " " ? "pre" : undefined,
                    minWidth: c === " " ? "0.3em" : undefined,
                    opacity: s,
                    transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)`,
                    color: `color-mix(in srgb, ${gFrom}, ${gTo} ${Math.round(t * 100)}%)`,
                    textShadow: `0 0 22px ${col}44`,
                  }}
                >
                  {c}
                </span>
              );
            })}
          </div>

          {/* tagline */}
          {tagline && (
            <div
              style={{
                marginTop: 16,
                opacity: tagIn,
                transform: `translateY(${interpolate(tagIn, [0, 1], [12, 0])}px)`,
                fontSize: Math.min(22, width / 56),
                fontWeight: 500,
                color: "#CBD5E1",
                fontFamily: FONT,
                letterSpacing: "0.42em",
                textTransform: "uppercase",
                paddingLeft: "0.42em",
              }}
            >
              {tagline}
            </div>
          )}

          {/* CTA chip */}
          {cta && (
            <div
              style={{
                marginTop: 30,
                display: "inline-block",
                opacity: ctaIn,
                transform: `translateY(${interpolate(ctaIn, [0, 1], [16, 0])}px) scale(${interpolate(ctaIn, [0, 1], [0.9, 1])})`,
                padding: "12px 28px",
                borderRadius: 999,
                fontSize: Math.min(20, width / 64),
                fontWeight: 700,
                fontFamily: FONT,
                color: "#0A0A14",
                background: `linear-gradient(90deg, ${gFrom}, ${gTo})`,
                boxShadow: `0 8px 30px ${accent}66`,
              }}
            >
              {cta}
            </div>
          )}
        </div>
      </AbsoluteFill>

      {/* grain */}
      <AbsoluteFill style={{ opacity: 0.06, mixBlendMode: "overlay", pointerEvents: "none" }}>
        <svg width="100%" height="100%">
          <filter id="lr-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#lr-grain)" />
        </svg>
      </AbsoluteFill>

      {/* vignette */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
