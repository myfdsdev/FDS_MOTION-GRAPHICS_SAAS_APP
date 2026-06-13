import { Composition } from "remotion";
import UserComposition from "./scenes/UserComposition.tsx";

const FPS = 30;

const DIMENSIONS = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:3": [1440, 1080],
};

// The composition renders the AI-generated UserComposition. Dimensions and
// duration come from inputProps (set per-render by the CLI / worker), so the
// same registered composition works for any aspect ratio / length.
//
// defaultProps are only used by the Remotion Studio preview.
const defaultProps = {
  aspectRatio: "16:9",
  durationInFrames: 20 * FPS,
};

export const Root = () => {
  return (
    <Composition
      id="video"
      component={UserComposition}
      durationInFrames={20 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => {
        const [width, height] = DIMENSIONS[props.aspectRatio] ?? DIMENSIONS["16:9"];
        const durationInFrames = Math.max(1, Math.round(Number(props.durationInFrames) || 20 * FPS));
        return { width, height, fps: FPS, durationInFrames };
      }}
    />
  );
};
