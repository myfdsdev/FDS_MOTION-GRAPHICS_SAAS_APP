// ---------------------------------------------------------------------------
// Per-element entrance / exit animation. Pure, deterministic, browser-safe so
// it can be imported from both the Remotion composition (renderer) and the
// editor's React canvas (live preview). Same math = same result on both
// sides, frame-for-frame.
//
// Each element optionally carries:
//   el.animation = {
//     in?:  { kind: "fade" | "slide-*" | "zoom-in" | "zoom-out" | "scale" | "pop", at, duration },
//     out?: { kind: "fade" | "slide-*" | "zoom-in" | "zoom-out" | "scale",         at, duration },
//   }
// `at` is seconds since the scene clip's start. `duration` is the length of
// the entrance/exit in seconds.
// ---------------------------------------------------------------------------

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
// Standard ease-out cubic — feels "natural" without depending on Remotion.
const ease = (t) => 1 - Math.pow(1 - t, 3);

function applyKind(kind, p, opacity, dx, dy, scale) {
  switch (kind) {
    case "fade":
      opacity *= p;
      break;
    case "slide-left":
      opacity *= p;
      dx += (1 - p) * -60;
      break;
    case "slide-right":
      opacity *= p;
      dx += (1 - p) * 60;
      break;
    case "slide-up":
      opacity *= p;
      dy += (1 - p) * 60;
      break;
    case "slide-down":
      opacity *= p;
      dy += (1 - p) * -60;
      break;
    case "zoom-in":
      opacity *= p;
      scale *= 0.7 + 0.3 * p;
      break;
    case "zoom-out":
      opacity *= p;
      scale *= 1.3 - 0.3 * p;
      break;
    case "scale":
      opacity *= p;
      scale *= 0.92 + 0.08 * p;
      break;
    case "pop": {
      // Slight overshoot at the end of the entrance.
      opacity *= p;
      const overshoot = p < 1 ? p * 1.08 : 1;
      scale *= 0.6 + 0.4 * overshoot;
      break;
    }
    default:
      break;
  }
  return { opacity, dx, dy, scale };
}

/**
 * Compute the live `{ opacity, transform }` an element should have at a
 * given scene-local time. Pure function — safe to call on every frame.
 */
export function getElementMotion(animation, sceneTime, sceneDuration) {
  let opacity = 1;
  let dx = 0;
  let dy = 0;
  let scale = 1;

  if (animation && animation.in) {
    const { kind, at, duration } = animation.in;
    const dur = Math.max(0.001, Number(duration) || 0.001);
    const p = ease(clamp01((sceneTime - (Number(at) || 0)) / dur));
    ({ opacity, dx, dy, scale } = applyKind(kind, p, opacity, dx, dy, scale));
  }

  if (animation && animation.out) {
    const { kind, at, duration } = animation.out;
    const dur = Math.max(0.001, Number(duration) || 0.001);
    // Exit progress 0..1, where 1 = fully exited.
    const p = ease(clamp01((sceneTime - (Number(at) || 0)) / dur));
    // 1 - p = "stay" factor; we re-apply the kind in reverse direction.
    const stay = 1 - p;
    const out = applyKind(kind, stay, 1, 0, 0, 1);
    opacity *= out.opacity;
    dx += out.dx;
    dy += out.dy;
    scale *= out.scale;
  }

  const transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
  return { opacity, transform };
}

/**
 * Default animation for newly-added elements — short fade-in. Users can
 * change or remove from the Properties panel.
 */
export function defaultElementAnimation() {
  return { in: { kind: "fade", at: 0, duration: 0.4 } };
}
