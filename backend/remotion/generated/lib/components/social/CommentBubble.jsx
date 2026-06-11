import React from 'react';
import { withDefaults } from '../../helpers.js';

export const CommentBubble = (props) => {
  const p = withDefaults(props, {
    avatarUrl: null,
    username: 'jane.designs',
    text: 'This is insane 🤯',
    background: 'rgba(255,255,255,0.95)',
    color: '#0f172a',
  });
  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', gap: 12, alignItems: 'flex-start',
        background: p.background,
        color: p.color,
        padding: 16,
        borderRadius: 18,
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
      }}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: p.avatarUrl ? `url(${p.avatarUrl}) center/cover` : 'linear-gradient(45deg, #a855f7, #22d3ee)',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{p.username}</div>
        <div style={{ fontSize: 20 }}>{p.text}</div>
      </div>
    </div>
  );
};
