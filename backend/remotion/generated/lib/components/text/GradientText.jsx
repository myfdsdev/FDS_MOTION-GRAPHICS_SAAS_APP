import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults } from '../../helpers.js';

/** Static-text-with-animated-gradient. Animates the gradient angle by default. */
export const GradientText = (props) => {
  const p = withDefaults(props, {
    text: 'Gradient',
    fontSize: 120,
    fontWeight: 900,
    colors: ['#a855f7', '#3b82f6', '#22d3ee'],
    align: 'center',
    animate: true,
    speed: 1,
  });
  const frame = useCurrentFrame();
  const angle = p.animate ? (frame * p.speed) % 360 : 90;
  const stops = (Array.isArray(p.colors) && p.colors.length >= 2 ? p.colors : ['#fff', '#aaa']).join(', ');

  return (
    <div
      style={{
        width: '100%',
        textAlign: p.align,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: p.fontWeight,
        fontSize: p.fontSize,
        backgroundImage: `linear-gradient(${angle}deg, ${stops})`,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        lineHeight: 1.1,
      }}
    >
      {p.text}
    </div>
  );
};
