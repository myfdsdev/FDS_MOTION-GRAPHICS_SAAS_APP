import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults } from '../../helpers.js';

/** Reveals what's behind by wiping in a direction. */
export const WipeTransition = (props) => {
  const p = withDefaults(props, {
    color: '#0b1020',
    direction: 'left-to-right',   // 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top'
    duration: 24,
  });
  const frame = useCurrentFrame();
  const p1 = interpolate(frame, [0, p.duration], [0, 100], { extrapolateRight: 'clamp' });

  let clip = '0 0 0 0';
  switch (p.direction) {
    case 'left-to-right':  clip = `0 0 0 ${p1}%`; break;
    case 'right-to-left':  clip = `0 ${p1}% 0 0`; break;
    case 'top-to-bottom':  clip = `${p1}% 0 0 0`; break;
    case 'bottom-to-top':  clip = `0 0 ${p1}% 0`; break;
  }

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: p.color,
        clipPath: `inset(${clip})`,
      }}
    />
  );
};
