import React from 'react';
import { withDefaults } from '../../helpers.js';

export const TestimonialCard = (props) => {
  const p = withDefaults(props, {
    quote: 'It changed how our team ships content. We move 5x faster.',
    name: 'Jane Doe',
    role: 'Head of Marketing, Acme',
    avatarUrl: null,
    accent: '#22d3ee',
    color: '#f8fafc',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        padding: 36,
        color: p.color,
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <div style={{ fontSize: 56, lineHeight: 1, color: p.accent }}>“</div>
      <div style={{ fontSize: 28, lineHeight: 1.35, fontWeight: 500 }}>{p.quote}</div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: p.avatarUrl ? `url(${p.avatarUrl}) center/cover` : p.accent,
          }}
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: 22 }}>{p.name}</div>
          <div style={{ fontSize: 18, opacity: 0.7 }}>{p.role}</div>
        </div>
      </div>
    </div>
  );
};
