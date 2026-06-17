import { Composition } from "remotion";
import UserComposition from "./scenes/UserComposition.tsx";
import {
  SceneRenderer,
  calculateSceneMetadata,
} from "./scenes/SceneRenderer.tsx";

const FPS = 30;

const DIMENSIONS = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:3": [1440, 1080],
};

// "video" — the existing single-component code-gen path. Dimensions and
// duration come from inputProps (set per-render by the CLI / worker).
const defaultProps = {
  aspectRatio: "16:9",
  durationInFrames: 20 * FPS,
};

// "scene" — the plan-driven SceneRenderer (LLM emits JSON → footage + overlays
// + audio, auto-merged across 3-6 scenes). The worker passes
// inputProps = { aspectRatio, plan }; width/height/duration are DERIVED by
// calculateSceneMetadata, so they are not set here. defaultProps shows a tiny
// two-scene color-background example so `npm start` renders something.
const scenePreviewProps = {
  aspectRatio: "16:9",
  plan: {
    scenes: [
      {
        id: "s1",
        durationSeconds: 4,
        background: { kind: "color", color: "#0B0F14", scrim: 0.2 },
        overlays: [
          {
            type: "heroTitle",
            props: { title: "Preview Scene", subtitle: "Plan-driven SceneRenderer" },
          },
        ],
      },
      {
        id: "s2",
        durationSeconds: 4,
        background: { kind: "color", color: "#11161D", scrim: 0.3 },
        overlays: [
          { type: "statReveal", props: { stat: "3-6", label: "segments, auto-merged" } },
        ],
      },
    ],
  },
};

export const Root = () => {
  return (
    <>
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
      <Composition
        id="scene"
        component={SceneRenderer}
        durationInFrames={8 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={scenePreviewProps}
        calculateMetadata={calculateSceneMetadata}
      />
    </>
  );
};
