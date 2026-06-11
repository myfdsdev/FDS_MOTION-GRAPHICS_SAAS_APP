import React from 'react';
import { withDefaults } from '../../helpers.js';

export const FeatureCard = (props) => {
  const p = withDefaults(props, {
    icon: '✨',
    title: 'Feature',
    description: 'A short benefit-led description of the feature.',
    accent: '#7c3aed',
    background: 'rgba(255,255,255,0.06)',
    color: '#f8fafc',
    radius: 24,
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: p.background,
        borderRadius: p.radius,
        border: '1px solid rgba(255,255,255,0.08)',
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        color: p.color,
        fontFamily: 'Inter, system-ui, sans-serif',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          width: 72, height: 72, borderRadius: 16,
          background: p.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
        }}
      >
        {p.icon}
      </div>
      <div style={{ fontSize: 36, fontWeight: 800 }}>{p.title}</div>
      <div style={{ fontSize: 22, lineHeight: 1.4, opacity: 0.78 }}>{p.description}</div>
    </div>
  );
};
