import React from 'react';
import { Img } from 'remotion';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults, asArray } from '../../helpers.js';

/** Staggered grid of logo URLs (or text fallbacks). */
export const LogoWall = (props) => {
  const p = withDefaults(props, {
    logos: ['Acme', 'Globex', 'Initech', 'Soylent', 'Umbrella', 'Hooli'],
    columns: 3,
    color: '#cbd5e1',
    fontSize: 32,
    staggerFrames: 4,
  });
  const frame = useCurrentFrame();
  const items = asArray(p.logos);

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'grid',
        gridTemplateColumns: `repeat(${p.columns}, 1fr)`,
        gap: 24,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {items.map((logo, i) => {
        const t = interpolate(frame, [i * p.staggerFrames, i * p.staggerFrames + 18], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        const isUrl = typeof logo === 'string' && /^https?:|^\//.test(logo);
        return (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              opacity: t,
              transform: `translateY(${(1 - t) * 16}px)`,
              padding: 16,
            }}
          >
            {isUrl ? (
              <Img src={logo} style={{ maxWidth: '70%', maxHeight: '70%', objectFit: 'contain' }} />
            ) : (
              <span style={{ color: p.color, fontWeight: 700, fontSize: p.fontSize }}>{logo}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
