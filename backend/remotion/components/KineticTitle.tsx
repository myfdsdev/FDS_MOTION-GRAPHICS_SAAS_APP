import {
  AbsoluteFill,
  interpolate,
  spring,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * KineticTitle — a "next level" animated title scene.
 *
 * Premium motion-graphics treatment, all self-contained (no assets, no fonts to
 * load): a drifting gradient-mesh backdrop, floating blurred light orbs for
 * depth, film grain, a vignette, and a kinetic headline where every character
 * springs in with a blur-reveal + 3D tilt, painted with a left-to-right color
 * gradient and a soft glow. A shimmering accent line draws under it.
 *
 * Designed to drop into SceneRenderer as a full-bleed overlay (it paints its
 * own background), so a single "kineticTitle" overlay = a whole premium scene.
 */

interface KineticTitleProps {
  title: string;
  subtitle?: string;
  /** [from, to] hex colors for the headline gradient (left→right). */
  gradient?: [string, string];
  /** background base color. */
  bg?: string;
  /** accent color for line + glow. */
  accent?: string;
}

import { DISPLAY_FONT } from "./fonts";
const FONT = DISPLAY_FONT;

/* ---- tiny hex color mixer (no deps) -------------------------------------- */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export const KineticTitle: React.FC<KineticTitleProps> = ({
  title,
  subtitle,
  gradient = ["#22D3EE", "#A78BFA"],
  bg = "#0B1020",
  accent = "#22D3EE",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  const [gFrom, gTo] = gradient;
  const chars = title.split("");
  const lastCharFrame = chars.length * 1.6 + 14;

  // Whole-scene slow parallax drift + settle, keeps even a static card alive.
  const intro = spring({ frame, fps, config: { damping: 30, stiffness: 60 } });
  const driftX = Math.sin(frame / 55) * 14;
  const driftY = Math.cos(frame / 70) * 10;
  const sceneScale = interpolate(intro, [0, 1], [1.08, 1]);

  // Floating light orbs (deterministic positions via Remotion random()).
  const orbs = Array.from({ length: 6 }, (_, i) => {
    const seed = i + 1;
    const baseX = random(`x${seed}`) * width;
    const baseY = random(`y${seed}`) * height;
    const size = 220 + random(`s${seed}`) * 360;
    const hue = i % 2 === 0 ? gFrom : gTo;
    const phase = random(`p${seed}`) * Math.PI * 2;
    const fx = Math.sin(frame / (60 + i * 8) + phase) * (40 + i * 6);
    const fy = Math.cos(frame / (70 + i * 7) + phase) * (34 + i * 5);
    return { baseX, baseY, size, hue, fx, fy, op: 0.16 + (i % 3) * 0.05 };
  });

  // Accent line draw + shimmer sweep.
  const lineSpring = spring({ frame: frame - 12, fps, config: { damping: 16, stiffness: 70 } });
  const lineWidth = interpolate(lineSpring, [0, 1], [0, Math.min(520, width * 0.42)]);
  const shimmer = interpolate((frame % 90) / 90, [0, 1], [-120, 120]);

  // Subtitle reveal.
  const subSpring = spring({ frame: frame - lastCharFrame, fps, config: { damping: 22 } });

  // Fade the whole thing out at the very end so scene transitions feel clean.
  const outOpacity = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: bg, opacity: outOpacity, overflow: "hidden" }}>
      {/* Layer 1: drifting gradient mesh */}
      <AbsoluteFill
        style={{
          transform: `translate(${driftX}px, ${driftY}px) scale(1.25)`,
          background: `
            radial-gradient(40% 50% at ${30 + driftX / 4}% ${35 + driftY / 4}%, ${gFrom}44 0%, transparent 60%),
            radial-gradient(45% 55% at ${72 - driftX / 4}% ${68 - driftY / 4}%, ${gTo}40 0%, transparent 62%),
            radial-gradient(60% 60% at 50% 120%, ${accent}22 0%, transparent 70%)
          `,
        }}
      />

      {/* Layer 2: floating light orbs (depth) */}
      {orbs.map((o, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: o.baseX - o.size / 2 + o.fx,
            top: o.baseY - o.size / 2 + o.fy,
            width: o.size,
            height: o.size,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${o.hue} 0%, transparent 70%)`,
            opacity: o.op * intro,
            filter: "blur(40px)",
          }}
        />
      ))}

      {/* Layer 4: content */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${sceneScale})`,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "86%", perspective: 900 }}>
          <div
            style={{
              fontSize: Math.min(96, width / 13),
              fontWeight: 800,
              fontFamily: FONT,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              transformStyle: "preserve-3d",
            }}
          >
            {chars.map((char, i) => {
              const delay = i * 1.6;
              const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 170 } });
              const t = chars.length > 1 ? i / (chars.length - 1) : 0;
              const color = mix(gFrom, gTo, t);
              const blur = interpolate(s, [0, 1], [12, 0]);
              const ty = interpolate(s, [0, 1], [44, 0]);
              const rot = interpolate(s, [0, 1], [-55, 0]);
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    whiteSpace: char === " " ? "pre" : undefined,
                    minWidth: char === " " ? "0.28em" : undefined,
                    opacity: s,
                    color,
                    transform: `translateY(${ty}px) rotateX(${rot}deg)`,
                    filter: `blur(${blur}px) drop-shadow(0 4px 24px ${accent}66)`,
                    textShadow: `0 0 28px ${color}55`,
                  }}
                >
                  {char}
                </span>
              );
            })}
          </div>

          {/* shimmering accent line */}
          <div
            style={{
              position: "relative",
              margin: "30px auto 0",
              height: 4,
              width: lineWidth,
              borderRadius: 4,
              background: `linear-gradient(90deg, ${gFrom}, ${gTo})`,
              boxShadow: `0 0 24px ${accent}aa`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: `calc(50% + ${shimmer}px)`,
                width: 60,
                height: "100%",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)",
              }}
            />
          </div>

          {subtitle && (
            <div
              style={{
                marginTop: 22,
                opacity: subSpring,
                transform: `translateY(${interpolate(subSpring, [0, 1], [16, 0])}px)`,
                fontSize: Math.min(30, width / 42),
                fontWeight: 500,
                color: "#E2E8F0",
                fontFamily: FONT,
                letterSpacing: interpolate(subSpring, [0, 1], [0.5, 0.32]) + "em",
                textTransform: "uppercase",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </AbsoluteFill>

      {/* Layer 5: film grain */}
      <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "overlay", pointerEvents: "none" }}>
        <svg width="100%" height="100%">
          <filter id="kt-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#kt-grain)" />
        </svg>
      </AbsoluteFill>

      {/* Layer 6: vignette */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
