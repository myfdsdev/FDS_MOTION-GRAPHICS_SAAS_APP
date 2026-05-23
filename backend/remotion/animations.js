import { interpolate, spring } from "remotion";

// Maps a scene's `animation` enum to an inline style for the given frame.
// Returns { opacity, transform, filter }.
export function getSceneStyle(animation, frame, fps, durationInFrames) {
  const inDur = Math.max(6, Math.min(15, Math.floor(durationInFrames / 3)));
  const fade = interpolate(frame, [0, inDur], [0, 1], { extrapolateRight: "clamp" });
  const slideIn = (from) =>
    interpolate(frame, [0, inDur], [from, 0], { extrapolateRight: "clamp" });
  const scaleIn = (from) =>
    interpolate(frame, [0, inDur], [from, 1], { extrapolateRight: "clamp" });

  switch (animation) {
    case "fade-in":
      return { opacity: fade };
    case "fade-out": {
      const out = interpolate(
        frame,
        [durationInFrames - inDur, durationInFrames],
        [1, 0],
        { extrapolateLeft: "clamp" }
      );
      return { opacity: Math.min(fade, out) };
    }
    case "slide-up":
      return { opacity: fade, transform: `translateY(${slideIn(70)}px)` };
    case "slide-left":
      return { opacity: fade, transform: `translateX(${slideIn(90)}px)` };
    case "slide-right":
      return { opacity: fade, transform: `translateX(${slideIn(-90)}px)` };
    case "zoom-in":
      return { opacity: fade, transform: `scale(${scaleIn(0.82)})` };
    case "zoom-out":
      return { opacity: fade, transform: `scale(${scaleIn(1.15)})` };
    case "fast-zoom":
      return {
        opacity: fade,
        transform: `scale(${interpolate(frame, [0, Math.floor(inDur / 2)], [1.3, 1], {
          extrapolateRight: "clamp",
        })})`,
      };
    case "camera-push":
      return {
        opacity: fade,
        transform: `scale(${interpolate(frame, [0, durationInFrames], [1, 1.08])})`,
      };
    case "blur-reveal":
      return {
        opacity: fade,
        filter: `blur(${interpolate(frame, [0, inDur], [18, 0], {
          extrapolateRight: "clamp",
        })}px)`,
      };
    case "pop-up": {
      const s = spring({ frame, fps, config: { damping: 12, stiffness: 170, mass: 0.7 } });
      return { opacity: fade, transform: `scale(${s})` };
    }
    case "typewriter":
      // Approximated as a fade for v1 (true char reveal is a follow-up).
      return { opacity: fade };
    default:
      return { opacity: fade };
  }
}
