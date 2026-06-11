import React from 'react';
import { useCurrentFrame } from 'remotion';
import { withDefaults } from '../../helpers.js';

/** Concentric pulsing rings. */
export const GlowRing = (props) => {
  const p = withDefaults(props, {
    color: '#a855f7',
    rings: 3,
    cycle: 90,
    thickness: 6,
  });
  const frame = useCurrentFrame();

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: p.rings }).map((_, i) => {
        const t = ((frame + (i * p.cycle) / p.rings) % p.cycle) / p.cycle;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: `${20 + t * 90}%`,
              height: `${20 + t * 90}%`,
              borderRadius: '50%',
              border: `${p.thickness}px solid ${p.color}`,
              opacity: 1 - t,
              boxShadow: `0 0 40px ${p.color}`,
            }}
          />
        );
      })}
    </div>
  );
};
