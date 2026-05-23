import { Composition } from "remotion";
import { Video } from "./Video.jsx";

const FPS = 30;

const DIMENSIONS = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};

// Used for the Remotion Studio preview and as a fallback. Real renders override
// these via calculateMetadata from the project's sceneJson.
const defaultProps = {
  duration: 20,
  aspectRatio: "16:9",
  template: "explainer-video",
  brandColors: ["#0a0a0a", "#8b5cf6"],
  scenes: [
    {
      scene: 1,
      duration: 5,
      text: "Your idea, in motion.",
      visual: "intro",
      animation: "fade-in",
      transition: "fade",
    },
    {
      scene: 2,
      duration: 5,
      text: "Generated in seconds.",
      visual: "outro",
      animation: "slide-up",
      transition: "cut",
    },
  ],
};

export const Root = () => {
  return (
    <Composition
      id="video"
      component={Video}
      durationInFrames={20 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => {
        const [width, height] = DIMENSIONS[props.aspectRatio] ?? DIMENSIONS["16:9"];
        const seconds =
          Number(props.duration) > 0
            ? Number(props.duration)
            : (props.scenes ?? []).reduce((sum, s) => sum + (Number(s.duration) || 0), 0) || 20;
        return {
          width,
          height,
          fps: FPS,
          durationInFrames: Math.max(1, Math.round(seconds * FPS)),
        };
      }}
    />
  );
};
