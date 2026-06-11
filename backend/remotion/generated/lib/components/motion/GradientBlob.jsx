import React from 'react';
import { useCurrentFrame } from 'remotion';
import { withDefaults } from '../../helpers.js';

/** Slow-drifting radial gradient blob, useful as a hero glow. */
export const GradientBlob = (props) => {
  const p = withDefaults(props, {
    color: '#7c3aed',
    secondaryColor: '#22d3ee',
    speed: 0.5,
    opacity: 0.85,
    blur: 80,
  });
  const frame = useCurrentFrame();
  const phase = frame * 0.01 * p.speed;
  const cx = 50 + Math.sin(phase) * 12;
  const cy = 50 + Math.cos(phase * 1.3) * 10;
  const tx = 50 + Math.cos(phase * 0.8) * 14;
  const ty = 50 + Math.sin(phase * 0.6) * 16;

  return (
    <div
      style={{
        width: '100%', height: '100%',
        position: 'relative',
        filter: `blur(${p.blur}px)`,
        opacity: p.opacity,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(40% 40% at ${cx}% ${cy}%, ${p.color}, transparent 70%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(45% 45% at ${tx}% ${ty}%, ${p.secondaryColor}, transparent 70%)`,
        mixBlendMode: 'screen',
      }} />
    </div>
  );
};
