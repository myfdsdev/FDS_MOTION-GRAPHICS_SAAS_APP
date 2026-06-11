import React from 'react';
import { withDefaults, asArray } from '../../helpers';

export const PricingCard = (props) => {
  const p = withDefaults(props, {
    plan: 'Pro',
    price: '$29',
    period: '/mo',
    features: ['Unlimited videos', 'AI voiceover', 'HD export', 'Priority support'],
    cta: 'Start free trial',
    highlighted: false,
    accent: '#7c3aed',
    color: '#f8fafc',
  });
  const features = asArray(p.features);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: p.highlighted
          ? `linear-gradient(160deg, ${p.accent} 0%, #1e1b4b 100%)`
          : 'rgba(255,255,255,0.05)',
        border: p.highlighted ? '2px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 28,
        padding: 32,
        color: p.color,
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ fontSize: 24, opacity: 0.8 }}>{p.plan}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontSize: 72, fontWeight: 900 }}>{p.price}</div>
        <div style={{ fontSize: 22, opacity: 0.7 }}>{p.period}</div>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {features.map((f, i) => (
          <li key={i} style={{ fontSize: 22, display: 'flex', gap: 10 }}>
            <span style={{ color: p.highlighted ? '#fff' : p.accent }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 'auto',
          background: p.highlighted ? '#ffffff' : p.accent,
          color: p.highlighted ? '#0f172a' : '#fff',
          padding: '16px 24px',
          borderRadius: 999,
          textAlign: 'center',
          fontWeight: 800,
          fontSize: 22,
        }}
      >
        {p.cta}
      </div>
    </div>
  );
};
