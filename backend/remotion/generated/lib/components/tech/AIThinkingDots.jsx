import React from 'react';
import { useCurrentFrame } from 'remotion';
import { withDefaults } from '../../helpers';

/** Three bouncing dots — classic "AI is thinking" indicator. */
export const AIThinkingDots = (props) => {
  const p = withDefaults(props, {
    color: '#ffffff',
    background: '#1f2937',
    dotSize: 14,
    cycle: 36,
    radius: 999,
  });
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        background: p.background,
        borderRadius: p.radius,
        padding: '0 22px',
      }}
    >
      {[0, 1, 2].map((i) => {
        const phase = ((frame + (i * p.cycle) / 3) % p.cycle) / p.cycle;
        const y = -Math.sin(phase * Math.PI * 2) * 8;
        const opacity = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
        return (
          <div
            key={i}
            style={{
              width: p.dotSize, height: p.dotSize,
              borderRadius: '50%',
              background: p.color,
              transform: `translateY(${y}px)`,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};
