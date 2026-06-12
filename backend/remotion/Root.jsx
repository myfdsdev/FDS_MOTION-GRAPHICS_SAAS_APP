import { Composition } from "remotion";
import { Video } from "./Video.jsx";

const FPS = 30;

const DIMENSIONS = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};

const defaultProps = {
  duration: 10,
  aspectRatio: "16:9",
  brandColors: ["#050509", "#ffffff"],
  scenes: [
    {
      scene: 1,
      duration: 10,
      text: "Plain text video preview.",
      headline: "Plain Text",
      subtext: "Plain renderer only.",
      visual: "Plain text on a solid background",
      sceneTheme: "plain-dark",
      animation: "fade-in",
      transition: "fade",
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
        const timeline = props.timeline;
        let seconds;
        if (timeline && Array.isArray(timeline.tracks) && timeline.tracks.length) {
          let max = Number(timeline.duration) || 0;
          for (const track of timeline.tracks) {
            for (const clip of track.clips ?? []) {
              max = Math.max(max, (Number(clip.start) || 0) + (Number(clip.duration) || 0));
            }
          }
          seconds = max || 20;
        } else {
          seconds =
            Number(props.duration) > 0
              ? Number(props.duration)
              : (props.scenes ?? []).reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0) || 20;
        }

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
