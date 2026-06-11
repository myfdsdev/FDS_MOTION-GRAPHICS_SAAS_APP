import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { withDefaults, easings } from '../../helpers.js';

/** A heart icon + animated like count. */
export const LikeCounter = (props) => {
  const p = withDefaults(props, {
    from: 0,
    to: 12483,
    duration: 60,
    delay: 0,
    color: '#ef4444',
    textColor: '#ffffff',
    fontSize: 56,
  });
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = interpolate(frame, [p.delay, p.delay + p.duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const value = Math.round(p.from + (p.to - p.from) * easings.easeOutCubic(t));
  const beat = spring({ frame: frame - p.delay, fps, config: { damping: 6, mass: 0.4, stiffness: 200 } });
  const heartScale = 1 + Math.sin(beat * Math.PI) * 0.18;

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: p.textColor,
      }}
    >
      <svg viewBox="0 0 24 24" width={p.fontSize * 1.4} height={p.fontSize * 1.4} style={{ transform: `scale(${heartScale})`, filter: `drop-shadow(0 0 12px ${p.color})` }}>
        <path d="M12 21s-7-4.5-9.5-9.5C.7 7.5 3.5 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.5 0 6.3 3.5 4.5 7.5C19 16.5 12 21 12 21Z" fill={p.color} />
      </svg>
      <div style={{ fontSize: p.fontSize, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
};
