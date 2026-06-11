import React from 'react';
import { Img } from 'remotion';
import { withDefaults } from '../../helpers.js';

export const InstagramPostMockup = (props) => {
  const p = withDefaults(props, {
    username: 'creator.studio',
    avatarUrl: null,
    imageUrl: null,
    caption: '✨ Make videos with one prompt.',
    likes: 12483,
    background: '#ffffff',
    color: '#0f172a',
  });

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: p.background, color: p.color,
        borderRadius: 28,
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: p.avatarUrl ? `url(${p.avatarUrl}) center/cover` : 'linear-gradient(45deg, #f43f5e, #f59e0b)',
            border: '2px solid rgba(0,0,0,0.06)',
          }}
        />
        <div style={{ fontWeight: 700, fontSize: 20 }}>{p.username}</div>
      </div>

      <div style={{ flex: 1, background: '#f1f5f9', position: 'relative' }}>
        {p.imageUrl ? (
          <Img src={p.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 28 }}>
          <span>♥</span><span>💬</span><span>✈</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{p.likes.toLocaleString()} likes</div>
        <div style={{ fontSize: 18 }}>
          <b>{p.username}</b> {p.caption}
        </div>
      </div>
    </div>
  );
};
