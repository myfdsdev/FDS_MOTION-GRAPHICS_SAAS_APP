import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults, easings } from '../../helpers.js';

/** Animates a number from `from` to `to`. */
export const CounterText = (props) => {
  const p = withDefaults(props, {
    from: 0,
    to: 100,
    duration: 60,
    delay: 0,
    prefix: '',
    suffix: '',
    fontSize: 140,
    fontWeight: 800,
    color: '#ffffff',
    align: 'center',
    decimals: 0,
    separator: true,
  });
  const frame = useCurrentFrame();
  const t = interpolate(frame, [p.delay, p.delay + p.duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const eased = easings.easeOutCubic(t);
  const value = p.from + (p.to - p.from) * eased;
  const rounded = Number(value.toFixed(p.decimals));
  const formatted = p.separator
    ? rounded.toLocaleString(undefined, { minimumFractionDigits: p.decimals })
    : String(rounded);

  return (
    <div
      style={{
        width: '100%',
        textAlign: p.align,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: p.fontWeight,
        fontSize: p.fontSize,
        color: p.color,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}
    >
      {p.prefix}{formatted}{p.suffix}
    </div>
  );
};
