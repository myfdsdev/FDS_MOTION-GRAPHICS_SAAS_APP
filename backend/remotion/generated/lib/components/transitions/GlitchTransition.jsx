import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults } from '../../helpers.js';

/** RGB-split + jitter glitch transition. */
export const GlitchTransition = (props) => {
  const p = withDefaults(props, {
    duration: 18,
    intensity: 14,
    background: '#0b1020',
  });
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, p.duration], [1, 0], { extrapolateRight: 'clamp' });
  const jitter = (Math.sin(frame * 5.13) + Math.cos(frame * 3.21)) * p.intensity * t;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: p.background, opacity: t > 0 ? 1 : 0 }}>
      <Bar color="#ff00ff" offset={jitter} />
      <Bar color="#00ffff" offset={-jitter} />
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(to bottom, transparent 0 3px, rgba(255,255,255,0.05) 3px 4px)',
          mixBlendMode: 'overlay',
          opacity: t,
        }}
      />
    </div>
  );
};

function Bar({ color, offset }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: color,
        opacity: 0.18,
        mixBlendMode: 'screen',
        transform: `translateX(${offset}px)`,
      }}
    />
  );
}
