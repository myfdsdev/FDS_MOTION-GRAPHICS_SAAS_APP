import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Series } from "remotion";
import { RetroGrid, FloatingConfetti, GlowOrb, GlitchTitle, KineticHeadline, NeonButton, CornerBrackets, LightSweep } from "./lib";
import { getTheme } from "./lib/themes";
import { ease, mulberry32 } from "./lib/helpers";

const T = getTheme("midnight-purple");

function HookScene() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const cameraDrift = interpolate(frame, [0, durationInFrames], [1, 1.04], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ transform: `scale(${cameraDrift})` }}>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${T.bgTop}, ${T.bgBottom})` }} />
      <RetroGrid color={T.gridColor} />
      <GlowOrb x="30%" y="40%" size={400} color={T.glowColor} blur={100} opacity={0.2} />
      <GlowOrb x="70%" y="60%" size={300} color={T.secondary || T.accent} blur={80} opacity={0.15} />
      <FloatingConfetti colors={T.confettiColors} count={20} seed={42} />
      <GlitchTitle text="Ready to Generate" fontSize={68} colors={T.titleColors} y="38%" />
      <KineticHeadline text="Enter a prompt to create your video" fontSize={28} color={T.muted} y="55%" fontWeight={400} />
      <CornerBrackets color={T.accent} delay={10} />
      <LightSweep />
    </AbsoluteFill>
  );
}

export default function GeneratedVideo() {
  const { durationInFrames } = useVideoConfig();
  return (
    <Series>
      <Series.Sequence durationInFrames={durationInFrames}>
        <HookScene />
      </Series.Sequence>
    </Series>
  );
}
