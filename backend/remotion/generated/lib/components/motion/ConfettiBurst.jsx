import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { withDefaults, mulberry32, asArray } from '../../helpers';

/** A confetti burst that erupts from `originY` (% from top) at frame 0. */
export const ConfettiBurst = (props) => {
  const p = withDefaults(props, {
    count: 80,
    seed: 7,
    colors: ['#a855f7', '#22d3ee', '#fde047', '#ec4899', '#34d399'],
    originY: 100,
    spread: 180,
    gravity: 0.04,
    size: 12,
  });
  const frame = useCurrentFrame();
  const colors = asArray(p.colors, ['#fff']);

  const pieces = useMemo(() => {
    const rand = mulberry32(p.seed);
    return Array.from({ length: p.count }, (_, i) => {
      const angle = (-Math.PI / 2) + ((rand() - 0.5) * (p.spread * Math.PI) / 180);
      const speed = 6 + rand() * 12;
      return {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: rand() * 360,
        rotSpeed: (rand() - 0.5) * 12,
        color: colors[i % colors.length],
        startX: 50 + (rand() - 0.5) * 6,
      };
    });
  }, [p.count, p.seed, p.spread]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {pieces.map((pc, i) => {
        const t = frame;
        const x = pc.startX + pc.vx * t * 0.4;
        const y = p.originY + pc.vy * t * 0.4 + 0.5 * p.gravity * t * t;
        const rotation = pc.rot + pc.rotSpeed * t;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: p.size,
              height: p.size * 0.6,
              background: pc.color,
              transform: `rotate(${rotation}deg)`,
              borderRadius: 2,
              opacity: y > 110 ? 0 : 1,
            }}
          />
        );
      })}
    </div>
  );
};
