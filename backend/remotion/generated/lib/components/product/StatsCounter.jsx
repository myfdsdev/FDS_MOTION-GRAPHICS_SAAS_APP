import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults, easings } from '../../helpers.js';

/** Big number + label, animated up from 0. */
export const StatsCounter = (props) => {
  const p = withDefaults(props, {
    value: 1000,
    label: 'Active users',
    prefix: '',
    suffix: '+',
    duration: 60,
    delay: 0,
    color: '#ffffff',
    accent: '#a855f7',
    align: 'center',
  });
  const frame = useCurrentFrame();
  const t = interpolate(frame, [p.delay, p.delay + p.duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const v = Math.round(p.value * easings.easeOutCubic(t));

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: p.align === 'left' ? 'flex-start' : 'center',
        justifyContent: 'center', gap: 8,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: p.color,
      }}
    >
      <div style={{ fontSize: 120, fontWeight: 900, color: p.accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {p.prefix}{v.toLocaleString()}{p.suffix}
      </div>
      <div style={{ fontSize: 28, opacity: 0.8, textAlign: p.align }}>{p.label}</div>
    </div>
  );
};
