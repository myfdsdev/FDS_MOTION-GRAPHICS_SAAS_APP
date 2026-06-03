import { useEffect, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
// The Remotion composition lives in the backend so the renderer can bundle
// it directly — Vite reaches it via the "@remotion-comp" alias, which means
// the editor previews the exact same component tree that's baked into the MP4.
import { Video } from "@remotion-comp/Video.jsx";
import type { AspectRatio } from "@/types";

// Must match backend/remotion/Root.jsx.
const FPS = 30;

const DIMENSIONS: Record<AspectRatio, [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};

interface LivePreviewProps {
  /** The current scene clip's full scene payload (already stripped of edit-
   *  overlay elements — the editor draws those itself on top). Typed loose
   *  because Remotion treats it as opaque inputProps. */
  scene: object | null;
  /** Seconds elapsed within the current scene clip. Drives the Player frame. */
  sceneTime: number;
  /** Length of the current scene clip in seconds. */
  sceneDuration: number;
  aspectRatio: AspectRatio;
  brandColors: string[];
}

/**
 * Renders the active scene through Remotion's <Player>, sized to fill its
 * parent. Sits underneath the editing handles so the user sees the real
 * animated template (kinetic title, bar chart, karaoke subtitle, …) while
 * dragging / scrubbing.
 *
 * We pass a single-scene mini-plan to the composition so the Player's
 * timeline maps 1:1 to the editor's scene window: frame 0 == scene start.
 */
export function LivePreview({
  scene,
  sceneTime,
  sceneDuration,
  aspectRatio,
  brandColors,
}: LivePreviewProps) {
  const playerRef = useRef<PlayerRef>(null);
  const [width, height] = DIMENSIONS[aspectRatio] ?? DIMENSIONS["16:9"];
  const durationInFrames = Math.max(1, Math.round((sceneDuration || 1) * FPS));

  // Single-scene mini-plan. We deliberately drop the elements array so the
  // editor's own overlay owns drawing them (keeps drag/edit interactions live
  // and avoids double-rendering each element).
  const inputProps = useMemo(() => {
    const cleaned = scene
      ? (() => {
          const { elements: _elements, ...rest } = scene as Record<string, unknown> & {
            elements?: unknown;
          };
          void _elements;
          // Match the scene's duration to the clip so the composition's
          // frame window aligns with the editor's scene window.
          return { ...rest, duration: sceneDuration };
        })()
      : null;
    return {
      aspectRatio,
      brandColors,
      duration: sceneDuration,
      scenes: cleaned ? [cleaned] : [],
    };
  }, [scene, sceneDuration, aspectRatio, brandColors]);

  // Mirror the editor playhead onto the Player. seekTo is frame-accurate.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const targetFrame = Math.min(
      durationInFrames - 1,
      Math.max(0, Math.round(sceneTime * FPS))
    );
    // Avoid spamming seekTo when we're already on the right frame.
    const current = p.getCurrentFrame?.() ?? -1;
    if (current !== targetFrame) p.seekTo(targetFrame);
  }, [sceneTime, durationInFrames]);

  if (!scene) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-xs text-faint">
        No scene under playhead
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      <Player
        ref={playerRef}
        component={Video}
        compositionWidth={width}
        compositionHeight={height}
        durationInFrames={durationInFrames}
        fps={FPS}
        inputProps={inputProps}
        controls={false}
        loop={false}
        autoPlay={false}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        spaceKeyToPlayOrPause={false}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
