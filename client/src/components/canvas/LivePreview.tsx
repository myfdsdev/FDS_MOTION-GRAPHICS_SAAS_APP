import { Component, useEffect, useMemo, useRef, type ReactNode } from "react";
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
  /** Random per-video seed mixed into the renderer's structural variant
   *  picker (chrome corner, layout grid, alignment, bg treatment, …). When
   *  this changes, the same scene picks a visibly different look. */
  structureSeed?: number;
  /** Seconds elapsed within the current scene clip. Drives the Player frame. */
  sceneTime: number;
  /** Length of the current scene clip in seconds. */
  sceneDuration: number;
  aspectRatio: AspectRatio;
  brandColors: string[];
  /** Editor playback state — when true, hand the Player its own clock so the
   *  animation runs natively instead of being seeked one frame at a time. */
  playing?: boolean;
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
  playing = false,
  structureSeed = 0,
}: LivePreviewProps) {
  const playerRef = useRef<PlayerRef>(null);
  const [width, height] = DIMENSIONS[aspectRatio] ?? DIMENSIONS["16:9"];
  const durationInFrames = Math.max(1, Math.round((sceneDuration || 1) * FPS));

  // Strip `elements` (canvas overlay draws them interactively).
  // In CUSTOM mode, also strip headline/subtext (they're in elements).
  // In TEMPLATE mode, keep headline/subtext (template renders them).
  const inputProps = useMemo(() => {
    const cleaned = scene
      ? (() => {
          const raw = scene as Record<string, unknown>;
          const mode = raw.renderMode || "custom";
          const { elements: _elements, ...rest } = raw as Record<string, unknown> & { elements?: unknown };
          void _elements;
          if (mode === "custom") {
            return { ...rest, headline: "", subtext: "", duration: sceneDuration };
          }
          return { ...rest, duration: sceneDuration };
        })()
      : null;
    return {
      aspectRatio,
      brandColors,
      duration: sceneDuration,
      scenes: cleaned ? [cleaned] : [],
      structureSeed,
    };
  }, [scene, sceneDuration, aspectRatio, brandColors, structureSeed]);

  // Mirror the editor playhead onto the Player when paused — frame accurate.
  // While playing, we let the Player run its own clock (see effect below)
  // so the animation looks smooth instead of being seeked every rAF tick.
  useEffect(() => {
    if (playing) return;
    const p = playerRef.current;
    if (!p) return;
    const targetFrame = Math.min(
      durationInFrames - 1,
      Math.max(0, Math.round(sceneTime * FPS))
    );
    const current = p.getCurrentFrame?.() ?? -1;
    if (current !== targetFrame) p.seekTo(targetFrame);
  }, [sceneTime, durationInFrames, playing]);

  // Hand play/pause control to the Player so frames flow at the composition's
  // native 30 fps rather than at whatever the editor's rAF happens to deliver.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) {
      // Align to the current playhead before starting so we don't jump.
      const targetFrame = Math.min(
        durationInFrames - 1,
        Math.max(0, Math.round(sceneTime * FPS))
      );
      try {
        p.seekTo(targetFrame);
        p.play();
      } catch {
        // Player not ready yet — the next render will retry.
      }
    } else {
      try {
        p.pause();
      } catch {
        /* ignore */
      }
    }
    // We intentionally don't include sceneTime here — re-running play() on
    // every frame would yank the Player back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, durationInFrames]);

  if (!scene) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-xs text-faint">
        No scene under playhead
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      <PreviewBoundary>
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
      </PreviewBoundary>
    </div>
  );
}

/**
 * Swallows render errors from inside the Remotion composition so a bad scene
 * payload (or a template bug) doesn't crash the whole editor with a white
 * screen. The user still sees the editing overlay and can fix the issue.
 */
class PreviewBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[LivePreview] composition crashed:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/40 p-6 text-center text-xs text-faint">
          Live preview hit an error: {this.state.error.message}. Editing still works.
        </div>
      );
    }
    return this.props.children;
  }
}
