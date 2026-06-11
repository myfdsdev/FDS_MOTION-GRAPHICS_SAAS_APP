import React from 'react';
import { withDefaults } from '../../helpers';

export const PriceTag = (props) => {
  const p = withDefaults(props, {
    price: '$29',
    strikethrough: '$49',
    label: 'Sale',
    background: '#ef4444',
    color: '#ffffff',
  });

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: p.background, color: p.color,
        borderRadius: 20,
        padding: '12px 22px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
        transform: 'rotate(-6deg)',
      }}
    >
      {p.label ? <div style={{ fontSize: 16, opacity: 0.85, letterSpacing: '0.16em' }}>{p.label.toUpperCase()}</div> : null}
      <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1 }}>{p.price}</div>
      {p.strikethrough ? (
        <div style={{ fontSize: 20, opacity: 0.75, textDecoration: 'line-through' }}>{p.strikethrough}</div>
      ) : null}
    </div>
  );
};
