import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { withDefaults, mulberry32 } from '../../helpers.js';

/** Pseudo voice waveform bars. Deterministic via `seed`. */
export const VoiceWaveform = (props) => {
  const p = withDefaults(props, {
    bars: 36,
    color: '#22d3ee',
    seed: 9,
    speed: 1,
    gap: 6,
    radius: 6,
  });
  const frame = useCurrentFrame();

  const baselines = useMemo(() => {
    const rand = mulberry32(p.seed);
    return Array.from({ length: p.bars }, () => 0.3 + rand() * 0.7);
  }, [p.bars, p.seed]);

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: p.gap,
      }}
    >
      {baselines.map((base, i) => {
        const phase = (frame + i * 4) * 0.18 * p.speed;
        const h = (base * 0.5 + Math.abs(Math.sin(phase)) * 0.5);
        return (
          <div
            key={i}
            style={{
              flex: 1,
              maxWidth: 16,
              height: `${h * 100}%`,
              background: p.color,
              borderRadius: p.radius,
              boxShadow: `0 0 12px ${p.color}`,
            }}
          />
        );
      })}
    </div>
  );
};
