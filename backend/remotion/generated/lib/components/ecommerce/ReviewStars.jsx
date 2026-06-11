import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults } from '../../helpers';

/** 5-star rating that fills star-by-star with a stagger. */
export const ReviewStars = (props) => {
  const p = withDefaults(props, {
    rating: 5,
    color: '#fbbf24',
    bgColor: 'rgba(255,255,255,0.18)',
    label: '4.9 from 1,284 reviews',
    labelColor: '#ffffff',
    stagger: 6,
  });
  const frame = useCurrentFrame();
  const rating = Math.max(0, Math.min(5, p.rating));

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const start = i * p.stagger;
          const t = interpolate(frame, [start, start + 10], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const fillT = i < Math.floor(rating) ? t : (i < rating ? t * (rating - i) : 0);
          return (
            <div key={i} style={{ position: 'relative', width: 56, height: 56 }}>
              <Star color={p.bgColor} />
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: `${fillT * 100}%` }}>
                <Star color={p.color} />
              </div>
            </div>
          );
        })}
      </div>
      {p.label ? <div style={{ color: p.labelColor, fontSize: 22, opacity: 0.85 }}>{p.label}</div> : null}
    </div>
  );
};

function Star({ color }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <path d="m12 2 3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-7Z" fill={color} />
    </svg>
  );
}
