import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults, easings } from '../../helpers.js';

/**
 * Animated SVG cursor. Optionally moves from `fromX/fromY` to `toX/toY`
 * during `moveStart..moveStart+moveDuration`. If a `clickFrame` is supplied
 * a click pulse rings out at that frame.
 *
 * Coordinates here are LOCAL to the element box (0..width / 0..height).
 */
export const MouseCursor = (props) => {
  const p = withDefaults(props, {
    fromX: 0, fromY: 0,
    toX: null, toY: null,
    moveStart: 0,
    moveDuration: 30,
    clickFrame: null,
    color: '#ffffff',
    size: 48,
  });
  const frame = useCurrentFrame();

  let x = p.fromX;
  let y = p.fromY;
  if (p.toX != null && p.toY != null) {
    const t = interpolate(frame, [p.moveStart, p.moveStart + p.moveDuration], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    const eased = easings.easeOutCubic(t);
    x = p.fromX + (p.toX - p.fromX) * eased;
    y = p.fromY + (p.toY - p.fromY) * eased;
  }

  const localClick = p.clickFrame != null ? Math.max(0, frame - p.clickFrame) : -1;
  const clickT = localClick >= 0 ? interpolate(localClick, [0, 18], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const showClick = localClick >= 0 && localClick < 24;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {showClick ? (
        <div
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: 8 + clickT * 80,
            height: 8 + clickT * 80,
            marginLeft: -(8 + clickT * 80) / 2 + p.size * 0.25,
            marginTop:  -(8 + clickT * 80) / 2 + p.size * 0.25,
            borderRadius: '50%',
            border: `3px solid ${p.color}`,
            opacity: 1 - clickT,
          }}
        />
      ) : null}
      <svg
        viewBox="0 0 24 24"
        width={p.size}
        height={p.size}
        style={{ position: 'absolute', left: x, top: y, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.45))' }}
      >
        <path
          d="M3 3l8 18 2.4-7.2L20.6 11 3 3z"
          fill={p.color}
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
};
