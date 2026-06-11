import React from 'react';
import { useCurrentFrame } from 'remotion';
import { withDefaults } from '../../helpers';

/** Chat bubble with optional character-by-character reveal. */
export const ChatBubble = (props) => {
  const p = withDefaults(props, {
    text: 'Hey, want to see what we built?',
    role: 'assistant',           // 'user' | 'assistant'
    background: null,             // overrides role default
    color: null,
    fontSize: 24,
    radius: 22,
    typewriter: false,
    charsPerFrame: 1.2,
    delay: 0,
  });
  const frame = useCurrentFrame();
  const isUser = p.role === 'user';
  const bg = p.background || (isUser ? '#7c3aed' : '#1f2937');
  const color = p.color || '#ffffff';

  let text = String(p.text);
  if (p.typewriter) {
    const local = Math.max(0, frame - p.delay);
    text = text.slice(0, Math.floor(local * p.charsPerFrame));
  }

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
      }}
    >
      <div
        style={{
          maxWidth: '90%',
          padding: '14px 20px',
          background: bg, color,
          borderRadius: p.radius,
          borderBottomRightRadius: isUser ? 6 : p.radius,
          borderBottomLeftRadius:  isUser ? p.radius : 6,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: p.fontSize,
          lineHeight: 1.35,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        }}
      >
        {text}
      </div>
    </div>
  );
};
