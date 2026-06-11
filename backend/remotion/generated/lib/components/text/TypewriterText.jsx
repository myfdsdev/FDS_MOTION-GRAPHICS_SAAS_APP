import React from 'react';
import { useCurrentFrame } from 'remotion';
import { withDefaults } from '../../helpers';

/** Character-by-character typewriter with blinking caret. */
export const TypewriterText = (props) => {
  const p = withDefaults(props, {
    text: 'Typing...',
    fontSize: 64,
    fontWeight: 600,
    color: '#ffffff',
    caret: true,
    caretColor: '#ffffff',
    delay: 0,
    charsPerFrame: 1.2,
    align: 'left',
    fontFamily: 'monospace',
  });
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - p.delay);
  const text = String(p.text);
  const n = Math.min(text.length, Math.floor(local * p.charsPerFrame));
  const showCaret = p.caret && Math.floor(frame / 15) % 2 === 0;

  return (
    <div
      style={{
        width: '100%',
        textAlign: p.align,
        fontFamily: p.fontFamily,
        fontWeight: p.fontWeight,
        fontSize: p.fontSize,
        color: p.color,
        whiteSpace: 'pre-wrap',
        lineHeight: 1.3,
      }}
    >
      {text.slice(0, n)}
      {showCaret ? <span style={{ color: p.caretColor }}>▍</span> : null}
    </div>
  );
};
