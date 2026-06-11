import React from 'react';
import { Img } from 'remotion';
import { withDefaults } from '../../helpers.js';

/** Full-bleed image with optional rounded corners. */
export const ImageScene = (props) => {
  const p = withDefaults(props, {
    src: null,
    objectFit: 'cover',
    radius: 0,
  });
  if (!p.src) return null;
  return (
    <Img
      src={p.src}
      style={{
        width: '100%',
        height: '100%',
        objectFit: p.objectFit,
        borderRadius: p.radius,
      }}
    />
  );
};
