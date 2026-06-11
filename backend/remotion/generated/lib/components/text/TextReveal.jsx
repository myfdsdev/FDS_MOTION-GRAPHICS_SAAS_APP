import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults } from '../../helpers.js';

/** Whole-string fade + soft upward slide. */
export const TextReveal = (props) => {
  const p = withDefaults(props, {
    text: 'Hello',
    fontSize: 96,
    fontWeight: 800,
    color: '#ffffff',
    align: 'center',
    delay: 0,
    duration: 24,
  });
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - p.delay);
  const t = interpolate(local, [0, p.duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        textAlign: p.align,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: p.fontWeight,
        fontSize: p.fontSize,
        color: p.color,
        opacity: t,
        transform: `translateY(${(1 - t) * 36}px)`,
        lineHeight: 1.15,
      }}
    >
      {p.text}
    </div>
  );
};
