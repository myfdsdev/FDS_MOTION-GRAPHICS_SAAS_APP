import React from 'react';
import { Img } from 'remotion';
import { withDefaults } from '../../helpers.js';

/** macOS-style browser chrome with optional content area (image or children). */
export const BrowserWindow = (props) => {
  const p = withDefaults(props, {
    url: 'app.example.com',
    title: '',
    contentUrl: null,
    background: '#ffffff',
    chromeBackground: '#f3f4f6',
    radius: 16,
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: p.background,
        borderRadius: p.radius,
        overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 44,
          background: p.chromeBackground,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 8,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <Dot color="#ff5f57" />
        <Dot color="#febc2e" />
        <Dot color="#28c840" />
        <div
          style={{
            flex: 1,
            margin: '0 14px',
            background: '#ffffff',
            borderRadius: 8,
            padding: '6px 12px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 14,
            color: '#374151',
            textAlign: 'center',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {p.url}
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {p.contentUrl ? (
          <Img src={p.contentUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : p.title ? (
          <div
            style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 700, fontSize: 56, color: '#0f172a',
            }}
          >
            {p.title}
          </div>
        ) : null}
      </div>
    </div>
  );
};

function Dot({ color }) {
  return <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />;
}
