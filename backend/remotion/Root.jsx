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
  duration: 10,
  aspectRatio: "16:9",
  template: "explainer-video",
  category: "business",
  brandColors: ["#0f172a", "#8b5cf6", "#38bdf8", "#34d399"],
  scenes: [
    {
      scene: 1,
      duration: 5,
      text: "Turn a prompt into a polished animated video.",
      headline: "",
      subtext: "",
      visual: "",
      sceneTemplate: "gradient-flow",
      animation: "fade-in",
      transition: "fade",
      elements: [
        { id: "h1", type: "text", x: 0.08, y: 0.32, w: 0.84, h: 0.18, z: 1, rotation: 0, text: "Your Idea, In Motion", size: 0.1, weight: 800, color: "#ffffff", align: "center", animation: { in: { kind: "slide-up", at: 0, duration: 0.5 } } },
        { id: "s1", type: "text", x: 0.15, y: 0.54, w: 0.7, h: 0.1, z: 2, rotation: 0, text: "Prompt to polished video in seconds", size: 0.04, weight: 500, color: "#cbd5e1", align: "center", animation: { in: { kind: "fade", at: 0.3, duration: 0.4 } } },
        { id: "i1", type: "icon", x: 0.46, y: 0.72, w: 0.08, h: 0.08, z: 3, rotation: 0, name: "Sparkles", color: "#8b5cf6", animation: { in: { kind: "pop", at: 0.5, duration: 0.3 } } },
      ],
    },
    {
      scene: 2,
      duration: 5,
      text: "Every scene is designed automatically.",
      headline: "",
      subtext: "",
      visual: "",
      sceneTemplate: "spotlight",
      animation: "slide-left",
      transition: "cut",
      elements: [
        { id: "h2", type: "text", x: 0.08, y: 0.34, w: 0.84, h: 0.16, z: 1, rotation: 0, text: "Designed Automatically", size: 0.09, weight: 800, color: "#ffffff", align: "center", animation: { in: { kind: "zoom-in", at: 0, duration: 0.5 } } },
        { id: "i2", type: "icon", x: 0.06, y: 0.70, w: 0.08, h: 0.08, z: 2, rotation: 0, name: "Zap", color: "#38bdf8", animation: { in: { kind: "slide-left", at: 0.2, duration: 0.4 } } },
        { id: "i3", type: "icon", x: 0.86, y: 0.70, w: 0.08, h: 0.08, z: 3, rotation: 0, name: "Rocket", color: "#34d399", animation: { in: { kind: "slide-right", at: 0.3, duration: 0.4 } } },
      ],
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
          // Total = the latest clip / zoom-region end across all tracks.
          let max = Number(timeline.duration) || 0;
          for (const track of timeline.tracks) {
            for (const clip of track.clips ?? []) {
              max = Math.max(max, (Number(clip.start) || 0) + (Number(clip.duration) || 0));
            }
          }
          for (const region of timeline.zoomRegions ?? []) {
            max = Math.max(max, Number(region.end) || 0);
          }
          seconds = max || 20;
        } else {
          seconds =
            Number(props.duration) > 0
              ? Number(props.duration)
              : (props.scenes ?? []).reduce((sum, s) => sum + (Number(s.duration) || 0), 0) || 20;
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
