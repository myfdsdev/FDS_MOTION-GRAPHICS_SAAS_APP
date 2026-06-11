import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults, asArray } from '../../helpers.js';

/**
 * SVG route between waypoints. Each point is {x, y} in 0..100 % space.
 * The path animates in over the scene.
 */
export const MapRoute = (props) => {
  const p = withDefaults(props, {
    points: [{ x: 15, y: 80 }, { x: 40, y: 35 }, { x: 75, y: 60 }, { x: 90, y: 20 }],
    color: '#fde047',
    pinColor: '#fde047',
    background: '#0b1220',
    strokeWidth: 4,
    duration: 90,
    showStartEnd: true,
  });
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, p.duration], [0, 1], { extrapolateRight: 'clamp' });
  const pts = asArray(p.points);
  if (pts.length < 2) return null;
  const d = pts.reduce((acc, pt, i) => acc + (i === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`), '');

  return (
    <div style={{ width: '100%', height: '100%', background: p.background, position: 'relative', borderRadius: 24, overflow: 'hidden' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
        <path
          d={d}
          fill="none"
          stroke={p.color}
          strokeWidth={p.strokeWidth}
          strokeDasharray="300"
          strokeDashoffset={300 - t * 300}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 6px ${p.color})` }}
        />
        {p.showStartEnd ? (
          <>
            <circle cx={pts[0].x} cy={pts[0].y} r="2" fill={p.pinColor} />
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2" fill={p.pinColor} opacity={t} />
          </>
        ) : null}
      </svg>
    </div>
  );
};
