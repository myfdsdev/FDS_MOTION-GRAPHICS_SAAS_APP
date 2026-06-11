import React from 'react';
import { Img } from 'remotion';
import { useCurrentFrame, interpolate, useVideoConfig } from 'remotion';
import { withDefaults } from '../../helpers';

/** Ken-Burns style zoom-and-pan over an image. */
export const ZoomPanImage = (props) => {
  const p = withDefaults(props, {
    src: null,
    fromScale: 1.0,
    toScale: 1.18,
    fromX: 0,
    toX: -4,
    fromY: 0,
    toY: -2,
    radius: 0,
  });
  if (!p.src) return null;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' });
  const scale = p.fromScale + (p.toScale - p.fromScale) * t;
  const x = p.fromX + (p.toX - p.fromX) * t;
  const y = p.fromY + (p.toY - p.fromY) * t;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: p.radius }}>
      <Img
        src={p.src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate(${x}%, ${y}%)`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  );
};
