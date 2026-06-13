import React from "react";
import { AbsoluteFill, Composition, OffthreadVideo, getInputProps, registerRoot } from "remotion";

const RefVideo = () => {
  const props = getInputProps();
  return (
    <AbsoluteFill style={{ backgroundColor: "#111", alignItems: "center", justifyContent: "center" }}>
      <OffthreadVideo
        src={props.src}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        muted
      />
    </AbsoluteFill>
  );
};

const Root = () => (
  <Composition
    id="ref"
    component={RefVideo}
    fps={30}
    width={640}
    height={480}
    durationInFrames={180}
    defaultProps={{ src: "", width: 640, height: 480, durationInFrames: 180 }}
    calculateMetadata={({ props }) => ({
      width: props.width || 640,
      height: props.height || 480,
      fps: 30,
      durationInFrames: props.durationInFrames || 180,
    })}
  />
);

registerRoot(Root);