import React from 'react';
import { useCurrentFrame, interpolate, useVideoConfig } from 'remotion';
import { withDefaults } from '../../helpers';

/** Solid panel sliding across — useful between scenes. */
export const SlideTransition = (props) => {
  const p = withDefaults(props, {
    color: '#7c3aed',
    direction: 'right',     // 'right' | 'left' | 'up' | 'down'
    duration: 30,
  });
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const enter = interpolate(frame, [0, p.duration], [0, 1], { extrapolateRight: 'clamp' });
  const exit  = interpolate(frame, [durationInFrames - p.duration, durationInFrames], [0, 1], { extrapolateLeft: 'clamp' });
  const t = Math.min(1, enter - exit + 0.5);   // covers screen mid-transition

  const axis = p.direction === 'left' || p.direction === 'right' ? 'X' : 'Y';
  const sign = p.direction === 'right' || p.direction === 'down' ? 1 : -1;
  const offset = sign * (1 - t) * 100;

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: p.color,
        transform: `translate${axis}(${offset}%)`,
      }}
    />
  );
};
