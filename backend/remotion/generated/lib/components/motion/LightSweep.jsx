import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults } from '../../helpers.js';

/** A diagonal light sweep that crosses the box every `cycle` frames. */
export const LightSweep = (props) => {
  const p = withDefaults(props, {
    color: 'rgba(255,255,255,0.55)',
    cycle: 90,
    angle: 110,
    width: 35,
  });
  const frame = useCurrentFrame();
  const t = (frame % p.cycle) / p.cycle;
  const x = interpolate(t, [0, 1], [-100, 100]);

  return (
    <div
      style={{
        width: '100%', height: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'inherit',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(${p.angle}deg, transparent ${(50 - p.width / 2)}%, ${p.color} 50%, transparent ${(50 + p.width / 2)}%)`,
          transform: `translateX(${x}%)`,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
};
