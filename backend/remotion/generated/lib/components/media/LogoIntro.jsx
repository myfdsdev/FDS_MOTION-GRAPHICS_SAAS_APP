import React from 'react';
import { Img } from 'remotion';
import { useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { withDefaults } from '../../helpers';

/** Spring-in logo with optional brand text below. */
export const LogoIntro = (props) => {
  const p = withDefaults(props, {
    src: null,
    text: 'Brand',
    color: '#ffffff',
    fontSize: 56,
    gap: 24,
  });
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, mass: 0.8, stiffness: 120 } });
  const scale = 0.7 + s * 0.3;

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: p.gap,
        opacity: Math.min(1, s),
        transform: `scale(${scale})`,
      }}
    >
      {p.src ? (
        <Img src={p.src} style={{ width: '50%', height: 'auto', objectFit: 'contain' }} />
      ) : (
        <div
          style={{
            width: 140, height: 140, borderRadius: 28,
            background: p.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#0f172a', fontWeight: 900, fontSize: 72,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {String(p.text || ' ')[0].toUpperCase()}
        </div>
      )}
      <div
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 800,
          fontSize: p.fontSize,
          color: p.color,
          letterSpacing: '0.04em',
        }}
      >
        {p.text}
      </div>
    </div>
  );
};
