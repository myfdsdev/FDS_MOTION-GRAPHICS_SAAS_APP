import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Series } from "remotion";

const fps = 30;
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const bgColor = "#09090b";
const surfaceColor = "#18181b";
const accentColor = "#a855f7";
const secondaryColor = "#ec4899";
const textColor = "#fafafa";
const textMutedColor = "#94a3b8";

const font = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// LAYER 1 — ANIMATED BACKGROUND
const AnimatedBackground = ({ frame, durationInFrames, offset = 0 }) => {
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const sinOffset = Math.sin((fra