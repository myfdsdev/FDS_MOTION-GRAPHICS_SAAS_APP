import React from 'react';
import { useCurrentFrame } from 'remotion';
import { withDefaults } from '../../helpers';

/** Text input where the value gets typed in character-by-character. */
export const TypingInput = (props) => {
  const p = withDefaults(props, {
    placeholder: 'Search...',
    value: '',
    fontSize: 32,
    color: '#0f172a',
    background: '#ffffff',
    radius: 14,
    delay: 0,
    charsPerFrame: 1.2,
    showCaret: true,
  });
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - p.delay);
  const n = Math.min(String(p.value).length, Math.floor(local * p.charsPerFrame));
  const visible = String(p.value).slice(0, n);
  const blink = Math.floor(frame / 15) % 2 === 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: p.background,
        borderRadius: p.radius,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: p.fontSize,
        color: visible ? p.color : '#9ca3af',
        boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.06), 0 1px 0 rgba(0,0,0,0.04)',
      }}
    >
      {visible || p.placeholder}
      {p.showCaret && visible && blink ? (
        <span style={{ marginLeft: 2, color: p.color }}>|</span>
      ) : null}
    </div>
  );
};
