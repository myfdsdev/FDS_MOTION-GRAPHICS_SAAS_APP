import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { withDefaults, mulberry32 } from '../../helpers';

/** Static-seeded particle field that drifts upward. Deterministic via `seed`. */
export const ParticleField = (props) => {
  const p = withDefaults(props, {
    count: 60,
    seed: 42,
    color: '#ffffff',
    size: 4,
    speed: 0.6,
    opacity: 0.7,
  });
  const frame = useCurrentFrame();

  const particles = useMemo(() => {
    const rand = mulberry32(p.seed);
    return Array.from({ length: p.count }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      r: 0.4 + rand() * 1.6,
      driftX: (rand() - 0.5) * 0.4,
      lifeOffset: rand() * 200,
    }));
  }, [p.count, p.seed]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', opacity: p.opacity }}>
      {particles.map((pt, i) => {
        const y = (pt.y - ((frame + pt.lifeOffset) * p.speed * 0.1)) % 100;
        const yy = y < 0 ? y + 100 : y;
        const x = (pt.x + (frame + pt.lifeOffset) * pt.driftX * 0.05) % 100;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${yy}%`,
              width: pt.r * p.size,
              height: pt.r * p.size,
              borderRadius: '50%',
              background: p.color,
              filter: 'blur(0.5px)',
            }}
          />
        );
      })}
    </div>
  );
};
