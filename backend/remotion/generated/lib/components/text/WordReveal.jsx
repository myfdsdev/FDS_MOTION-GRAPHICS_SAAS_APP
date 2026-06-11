import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { withDefaults } from '../../helpers.js';

/** Reveals one word at a time. */
export const WordReveal = (props) => {
  const p = withDefaults(props, {
    text: 'Make every word count',
    fontSize: 80,
    fontWeight: 800,
    color: '#ffffff',
    align: 'center',
    framesPerWord: 6,
    delay: 0,
  });
  const frame = useCurrentFrame();
  const words = String(p.text).split(/\s+/).filter(Boolean);

  return (
    <div
      style={{
        width: '100%',
        textAlign: p.align,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: p.fontWeight,
        fontSize: p.fontSize,
        color: p.color,
        lineHeight: 1.2,
      }}
    >
      {words.map((w, i) => {
        const start = p.delay + i * p.framesPerWord;
        const t = interpolate(frame, [start, start + p.framesPerWord], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              marginRight: '0.35em',
              opacity: t,
              transform: `translateY(${(1 - t) * 24}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
