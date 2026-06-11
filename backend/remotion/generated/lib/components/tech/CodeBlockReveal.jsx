import React from 'react';
import { useCurrentFrame } from 'remotion';
import { withDefaults, asArray } from '../../helpers';

/** Stagger-reveals each line of a code block. */
export const CodeBlockReveal = (props) => {
  const p = withDefaults(props, {
    lines: [
      "const ai = require('director');",
      "const plan = await ai.generate(prompt);",
      "render(plan);",
    ],
    language: 'js',
    background: '#0b1020',
    color: '#e2e8f0',
    accent: '#a855f7',
    fontSize: 24,
    framesPerLine: 10,
    delay: 0,
    radius: 16,
  });
  const frame = useCurrentFrame();
  const lines = asArray(p.lines, ['']);

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: p.background, color: p.color,
        borderRadius: p.radius,
        padding: 24,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: p.fontSize,
        lineHeight: 1.5,
        boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, opacity: 0.55 }}>
        <Dot c="#ff5f57" /><Dot c="#febc2e" /><Dot c="#28c840" />
        <span style={{ marginLeft: 12, fontSize: 14 }}>{p.language}</span>
      </div>
      {lines.map((line, i) => {
        const visible = frame >= p.delay + i * p.framesPerLine;
        return (
          <div key={i} style={{ display: 'flex', gap: 14, opacity: visible ? 1 : 0 }}>
            <span style={{ color: p.accent, opacity: 0.6, width: '2ch' }}>{i + 1}</span>
            <span>{line}</span>
          </div>
        );
      })}
    </div>
  );
};

function Dot({ c }) {
  return <div style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />;
}
