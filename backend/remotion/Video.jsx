import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Series,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getSceneStyle } from "./animations.js";

const DEFAULT_COLORS = ["#050509", "#ffffff"];
const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const Video = ({ brandColors, scenes, timeline }) => {
  const { fps } = useVideoConfig();
  const colors = Array.isArray(brandColors) && brandColors.length ? brandColors : DEFAULT_COLORS;

  if (timeline && Array.isArray(timeline.tracks) && timeline.tracks.length) {
    return <TimelineVideo timeline={timeline} colors={colors} />;
  }

  const list = Array.isArray(scenes) && scenes.length ? scenes : [];
  return (
    <AbsoluteFill style={{ backgroundColor: solidColor(colors[0], DEFAULT_COLORS[0]) }}>
      <Series>
        {list.map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={Math.max(1, Math.round((Number(scene.duration) || 4) * fps))}>
            <PlainScene scene={scene} colors={colors} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

function PlainScene({ scene, colors, clipDurationInFrames }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const dur = clipDurationInFrames ?? durationInFrames;
  const style = getSceneStyle(scene?.animation, frame, fps, dur);
  const bg = solidColor(colors?.[0], DEFAULT_COLORS[0]);

  return (
    <AbsoluteFill style={{ ...style, backgroundColor: bg, overflow: "hidden" }}>
      <PlainText headline={scene?.headline} subtext={scene?.subtext || scene?.text} frame={frame} />
    </AbsoluteFill>
  );
}

function PlainText({ headline, subtext, frame }) {
  const title = String(headline || "").trim();
  const body = String(subtext || "").trim();
  if (!title && !body) return null;

  const titleIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bodyIn = interpolate(frame, [12, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 18], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bodyY = interpolate(frame, [12, 30], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "9%", fontFamily: FONT }}>
      <div style={{ width: "100%", maxWidth: 1080, textAlign: "center" }}>
        {title ? (
          <div
            style={{
              color: "#ffffff",
              fontSize: 78,
              fontWeight: 850,
              lineHeight: 0.98,
              opacity: titleIn,
              transform: `translateY(${titleY}px)`,
            }}
          >
            {title}
          </div>
        ) : null}
        {body ? (
          <div
            style={{
              marginTop: title ? 28 : 0,
              color: "rgba(255,255,255,0.72)",
              fontSize: 28,
              fontWeight: 520,
              lineHeight: 1.35,
              opacity: bodyIn,
              transform: `translateY(${bodyY}px)`,
            }}
          >
            {body}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

function TimelineVideo({ timeline, colors }) {
  const { fps } = useVideoConfig();
  const tracks = Array.isArray(timeline.tracks) ? timeline.tracks : [];
  const visualTracks = tracks.filter((track) => track.kind !== "audio");
  const audioTracks = tracks.filter((track) => track.kind === "audio");

  return (
    <AbsoluteFill style={{ backgroundColor: solidColor(colors[0], DEFAULT_COLORS[0]) }}>
      {visualTracks.map((track) =>
        (track.clips ?? []).map((clip, i) => (
          <Sequence key={clip.id ?? `${track.id}-${i}`} from={frames(clip.start, fps)} durationInFrames={durationFrames(clip.duration, fps)} layout="none">
            <ClipView clip={clip} colors={colors} fps={fps} />
          </Sequence>
        )),
      )}
      {audioTracks.map((track) =>
        track.muted
          ? null
          : (track.clips ?? [])
              .filter((clip) => clip.src)
              .map((clip, i) => (
                <Sequence key={clip.id ?? `${track.id}-audio-${i}`} from={frames(clip.start, fps)} durationInFrames={durationFrames(clip.duration, fps)}>
                  <Audio src={clip.src} startFrom={frames(clip.trimStart ?? 0, fps)} volume={clip.volume == null ? 1 : clip.volume} />
                </Sequence>
              )),
      )}
    </AbsoluteFill>
  );
}

function ClipView({ clip, colors, fps }) {
  if (clip.type === "text") {
    return (
      <PlainScene
        colors={colors}
        clipDurationInFrames={durationFrames(clip.duration, fps)}
        scene={{
          headline: clip.text || clip.label || "",
          subtext: "",
          animation: clip.animation || "fade-in",
        }}
      />
    );
  }

  return (
    <PlainScene
      colors={colors}
      clipDurationInFrames={durationFrames(clip.duration, fps)}
      scene={clip.scene || { headline: clip.label || "", subtext: "", animation: clip.animation || "fade-in" }}
    />
  );
}

function frames(seconds, fps) {
  return Math.max(0, Math.round((Number(seconds) || 0) * fps));
}

function durationFrames(seconds, fps) {
  return Math.max(1, Math.round((Number(seconds) || 0) * fps));
}

function solidColor(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? value : fallback;
}
