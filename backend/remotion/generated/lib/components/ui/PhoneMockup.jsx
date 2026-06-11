import React from 'react';
import { Img } from 'remotion';
import { withDefaults } from '../../helpers';

/** iPhone-style phone with notch + screen content. */
export const PhoneMockup = (props) => {
  const p = withDefaults(props, {
    screenUrl: null,
    background: '#000000',
    frameColor: '#111827',
    screenBackground: '#0f172a',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: p.frameColor,
        borderRadius: 56,
        padding: 14,
        boxShadow: '0 30px 80px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          background: p.screenBackground,
          borderRadius: 42,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* notch */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '38%',
            height: 32,
            background: '#000',
            borderRadius: 999,
            zIndex: 2,
          }}
        />
        {p.screenUrl ? (
          <Img src={p.screenUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
      </div>
    </div>
  );
};
