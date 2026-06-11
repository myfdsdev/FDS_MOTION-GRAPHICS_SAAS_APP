import React from 'react';
import { useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { withDefaults } from '../../helpers';

/** Map-pin with bounce-in and label. */
export const LocationPin = (props) => {
  const p = withDefaults(props, {
    label: 'Tokyo',
    color: '#ef4444',
    textColor: '#ffffff',
    fontSize: 24,
  });
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 8, mass: 0.6, stiffness: 160 } });

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transform: `translateY(${(1 - s) * -20}px) scale(${0.7 + s * 0.3})`,
        opacity: Math.min(1, s),
      }}
    >
      <svg width="64%" height="64%" viewBox="0 0 24 24">
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5 7 13 7 13s7-8 7-13c0-3.87-3.13-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
          fill={p.color}
          stroke="rgba(0,0,0,0.45)"
          strokeWidth="0.8"
        />
      </svg>
      <div
        style={{
          marginTop: 6,
          padding: '6px 12px',
          background: p.color,
          color: p.textColor,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: p.fontSize,
          fontWeight: 700,
          borderRadius: 8,
        }}
      >
        {p.label}
      </div>
    </div>
  );
};
