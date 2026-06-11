import React from 'react';
import { useCurrentFrame, interpolate, useVideoConfig } from 'remotion';
import { withDefaults } from '../../helpers.js';

/**
 * Full-bleed fade-from-color. Use as an overlay element to "wash" a scene
 * in/out. `mode`: 'in' (color → transparent), 'out' (transparent → color),
 * or 'inOut' (color → transparent → color).
 */
export const FadeTransition = (props) => {
  const p = withDefaults(props, {
    color: '#000000',
    mode: 'in',
    duration: 24,
  });
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  let opacity = 1;
  if (p.mode === 'in') {
    opacity = interpolate(frame, [0, p.duration], [1, 0], { extrapolateRight: 'clamp' });
  } else if (p.mode === 'out') {
    opacity = interpolate(frame, [durationInFrames - p.duration, durationInFrames], [0, 1], { extrapolateLeft: 'clamp' });
  } else {
    const halfIn  = interpolate(frame, [0, p.duration], [1, 0], { extrapolateRight: 'clamp' });
    const halfOut = interpolate(frame, [durationInFrames - p.duration, durationInFrames], [0, 1], { extrapolateLeft: 'clamp' });
    opacity = Math.max(halfIn, halfOut);
  }

  return <div style={{ width: '100%', height: '100%', background: p.color, opacity, pointerEvents: 'none' }} />;
};
