import React from 'react';
import { Img } from 'remotion';
import { withDefaults } from '../../helpers';

export const ProductCard = (props) => {
  const p = withDefaults(props, {
    imageUrl: null,
    title: 'Aurora Tee',
    subtitle: 'Limited edition · Unisex',
    price: '$49',
    badge: null,
    badgeColor: '#ef4444',
    background: '#ffffff',
    color: '#0f172a',
    radius: 24,
  });

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: p.background, color: p.color,
        borderRadius: p.radius, overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
        position: 'relative',
      }}
    >
      {p.badge ? (
        <div
          style={{
            position: 'absolute', top: 14, left: 14, zIndex: 2,
            padding: '6px 12px', background: p.badgeColor, color: '#fff',
            fontWeight: 800, fontSize: 16, borderRadius: 999,
            letterSpacing: '0.04em',
          }}
        >
          {p.badge}
        </div>
      ) : null}
      <div style={{ flex: 3, background: '#f1f5f9' }}>
        {p.imageUrl ? (
          <Img src={p.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
      </div>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{p.title}</div>
        <div style={{ fontSize: 18, opacity: 0.65 }}>{p.subtitle}</div>
        <div style={{ marginTop: 8, fontSize: 32, fontWeight: 900 }}>{p.price}</div>
      </div>
    </div>
  );
};
