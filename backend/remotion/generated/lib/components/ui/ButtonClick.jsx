import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { withDefaults } from '../../helpers';

/** A button that pulses + scales when clicked at `clickFrame`. */
export const ButtonClick = (props) => {
  const p = withDefaults(props, {
    label: 'Get started',
    color: '#ffffff',
    background: '#7c3aed',
    fontSize: 32,
    radius: 999,
    clickFrame: 30,
  });
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - p.clickFrame);
  const press = spring({ frame: local, fps, config: { damping: 6, mass: 0.4, stiffness: 200 } });
  const ringT = interpolate(local, [0, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = 1 - press * 0.06;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {ringT > 0 && local < 30 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: p.radius,
            border: `4px solid ${p.background}`,
            transform: `scale(${1 + ringT * 0.25})`,
            opacity: 1 - ringT,
          }}
        />
      ) : null}
      <div
        style={{
          padding: '20px 36px',
          borderRadius: p.radius,
          background: p.background,
          color: p.color,
          fontWeight: 800,
          fontSize: p.fontSize,
          fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          transform: `scale(${scale})`,
        }}
      >
        {p.label}
      </div>
    </div>
  );
};
