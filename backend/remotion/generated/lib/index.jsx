import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { ease, mulberry32 } from "./helpers.js";

// ═══════════════════════════════════════════════════════════════
// RETRO GRID — perspective floor / ceiling with animated lines
// ═══════════════════════════════════════════════════════════════
export const RetroGrid = ({ color = "rgba(139,92,246,0.15)", speed = 0.5, position = "bottom" }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const offset = (frame * speed) % 60;
  const isBottom = position === "bottom";
  return (
    <div style={{
      position: "absolute", left: 0, width: "100%",
      top: isBottom ? "55%" : 0, height: isBottom ? "45%" : "45%",
      overflow: "hidden",
      perspective: 400, perspectiveOrigin: "50% 0%",
    }}>
      <div style={{
        position: "absolute", width: "200%", height: "200%", left: "-50%", top: 0,
        transform: "rotateX(60deg)", transformOrigin: "50% 0%",
        backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
        backgroundPosition: `0 ${offset}px`,
      }} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// FLOATING CONFETTI — seeded deterministic particles
// ═══════════════════════════════════════════════════════════════
export const FloatingConfetti = ({ colors = ["#8b5cf6","#38bdf8","#ec4899"], count = 25, seed = 42, speed = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const rng = mulberry32(seed);
  const particles = Array.from({ length: count }, (_, i) => ({
    x: rng() * width,
    y: rng() * height,
    size: 3 + rng() * 6,
    speedY: (0.3 + rng() * 0.8) * speed,
    speedX: (rng() - 0.5) * 0.4 * speed,
    rotation: rng() * 360,
    rotSpeed: (rng() - 0.5) * 3,
    color: colors[Math.floor(rng() * colors.length)],
    shape: rng() > 0.5 ? "circle" : "rect",
    delay: rng() * 30,
  }));
  return (
    <>
      {particles.map((p, i) => {
        const y = (p.y - (frame - p.delay) * p.speedY * 2) % (height + 40) - 20;
        const x = p.x + Math.sin(frame * 0.03 + i) * 20 * p.speedX;
        const rot = p.rotation + frame * p.rotSpeed;
        const opacity = interpolate(Math.sin(frame * 0.05 + i * 0.7), [-1, 1], [0.2, 0.6]);
        return (
          <div key={i} style={{
            position: "absolute", left: x, top: y < -20 ? height + y : y,
            width: p.size, height: p.shape === "circle" ? p.size : p.size * 0.6,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            backgroundColor: p.color, opacity,
            transform: `rotate(${rot}deg)`,
          }} />
        );
      })}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
// GLOW ORB — blurred ambient circle for depth
// ═══════════════════════════════════════════════════════════════
export const GlowOrb = ({ x = "50%", y = "50%", size = 300, color = "#8b5cf6", blur = 80, opacity = 0.25 }) => {
  const frame = useCurrentFrame();
  const dx = Math.sin(frame * 0.007) * 20;
  const dy = Math.cos(frame * 0.009) * 15;
  const pulse = interpolate(Math.sin(frame * 0.04), [-1, 1], [opacity * 0.7, opacity]);
  return (
    <div style={{
      position: "absolute",
      left: typeof x === "number" ? x + dx : x,
      top: typeof y === "number" ? y + dy : y,
      width: size, height: size, borderRadius: "50%",
      backgroundColor: color, filter: `blur(${blur}px)`,
      opacity: pulse, transform: "translate(-50%, -50%)",
      ...(typeof x === "string" ? { marginLeft: dx } : {}),
      ...(typeof y === "string" ? { marginTop: dy } : {}),
    }} />
  );
};

// ═══════════════════════════════════════════════════════════════
// GLITCH TITLE — 3-layer chromatic offset text
// ═══════════════════════════════════════════════════════════════
export const GlitchTitle = ({ text, fontSize = 72, fontWeight = 900, colors = ["#a78bfa","#8b5cf6","#6d28d9"], y = "35%", fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } });
  const glitchX = Math.sin(frame * 0.15) * 3;
  const glitchY = Math.cos(frame * 0.12) * 2;
  const scale = interpolate(enter, [0, 1], [0.8, 1]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const base = {
    position: "absolute", left: 0, width: "100%", textAlign: "center",
    top: y, fontSize, fontWeight, fontFamily: fontFamily || "Inter, system-ui, sans-serif",
    lineHeight: 1.1, padding: "0 40px", boxSizing: "border-box",
  };
  return (
    <div style={{ opacity, transform: `scale(${scale})` }}>
      <div style={{ ...base, color: colors[0], transform: `translate(${glitchX}px, ${glitchY}px)`, opacity: 0.7 }}>{text}</div>
      <div style={{ ...base, color: colors[1], transform: `translate(${-glitchX * 0.7}px, ${-glitchY * 0.7}px)`, opacity: 0.7 }}>{text}</div>
      <div style={{ ...base, color: colors[2] || "#fff" }}>{text}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// KINETIC HEADLINE — word-by-word spring entrance
// ═══════════════════════════════════════════════════════════════
export const KineticHeadline = ({ text, fontSize = 64, fontWeight = 900, color = "#f1f5f9", y = "35%", stagger = 4, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div style={{
      position: "absolute", top: y, left: 0, width: "100%", textAlign: "center",
      padding: "0 40px", boxSizing: "border-box", display: "flex",
      flexWrap: "wrap", justifyContent: "center", gap: `0 ${fontSize * 0.3}px`,
    }}>
      {words.map((word, i) => {
        const s = spring({ frame: frame - i * stagger, fps, config: { damping: 12, stiffness: 150, mass: 0.7 } });
        const ty = interpolate(s, [0, 1], [60, 0]);
        const op = interpolate(s, [0, 1], [0, 1]);
        return (
          <span key={i} style={{
            fontSize, fontWeight, color,
            fontFamily: fontFamily || "Inter, system-ui, sans-serif",
            transform: `translateY(${ty}px)`, opacity: op,
            display: "inline-block", lineHeight: 1.2,
          }}>{word}</span>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// NEON BUTTON — glowing CTA with pulse
// ═══════════════════════════════════════════════════════════════
export const NeonButton = ({ label = "Subscribe", icon, color = "#8b5cf6", delay = 0, x = "50%", y = "75%" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 150, mass: 0.8 } });
  const ty = interpolate(s, [0, 1], [60, 0]);
  const op = interpolate(s, [0, 1], [0, 1]);
  const glow = interpolate(Math.sin((frame - delay) * 0.08), [-1, 1], [0.4, 0.9]);
  return (
    <div style={{
      position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) translateY(${ty}px)`,
      opacity: op,
    }}>
      <div style={{
        padding: "16px 40px", borderRadius: 30,
        backgroundColor: color, color: "#fff",
        fontSize: 22, fontWeight: 700, fontFamily: "Inter, system-ui, sans-serif",
        display: "flex", alignItems: "center", gap: 10,
        boxShadow: `0 0 ${20 + glow * 20}px ${color}, 0 0 ${40 + glow * 30}px ${color}44`,
      }}>
        {icon && <span style={{ fontSize: 24 }}>{icon}</span>}
        {label}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ENGAGE ROW — like / comment / share bar (social proof)
// ═══════════════════════════════════════════════════════════════
export const EngageRow = ({ likes = "12K", comments = "840", shares = "2.1K", color = "#fff", delay = 0, y = "82%" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = [
    { icon: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z", label: likes },
    { icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z", label: comments },
    { icon: "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z", label: shares },
  ];
  return (
    <div style={{
      position: "absolute", left: "50%", top: y,
      transform: "translateX(-50%)", display: "flex", gap: 40,
    }}>
      {items.map((item, i) => {
        const s = spring({ frame: frame - delay - i * 5, fps, config: { damping: 12, stiffness: 140, mass: 0.6 } });
        const op = interpolate(s, [0, 1], [0, 1]);
        const ty = interpolate(s, [0, 1], [30, 0]);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, opacity: op, transform: `translateY(${ty}px)` }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={color}><path d={item.icon} /></svg>
            <span style={{ color, fontSize: 18, fontWeight: 600, fontFamily: "Inter, system-ui, sans-serif" }}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// STAT COUNTER — animated counting number
// ═══════════════════════════════════════════════════════════════
export const StatCounter = ({ value = 100, prefix = "", suffix = "", label = "", color = "#f1f5f9", accentColor = "#8b5cf6", delay = 0, x = "50%", y = "50%", fontSize = 72 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 100, mass: 0.8 } });
  const val = interpolate(s, [0, 1], [0, value]);
  const op = interpolate(s, [0, 1], [0, 1]);
  const ty = interpolate(s, [0, 1], [40, 0]);
  return (
    <div style={{
      position: "absolute", left: x, top: y,
      transform: `translate(-50%, -50%) translateY(${ty}px)`,
      opacity: op, textAlign: "center",
    }}>
      <div style={{ fontSize, fontWeight: 900, color, fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1 }}>
        {prefix}{Math.round(val).toLocaleString()}{suffix}
      </div>
      {label && (
        <div style={{ fontSize: fontSize * 0.22, fontWeight: 500, color: accentColor, marginTop: 8, fontFamily: "Inter, system-ui, sans-serif", textTransform: "uppercase", letterSpacing: 2 }}>
          {label}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DEVICE MOCKUP — phone / laptop / browser
// ═══════════════════════════════════════════════════════════════
export const DeviceMockup = ({ type = "phone", children, delay = 0, x = "50%", y = "50%", scale: s = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 130, mass: 0.8 } });
  const ty = interpolate(enter, [0, 1], [80, 0]);
  const op = interpolate(enter, [0, 1], [0, 1]);
  const float = Math.sin(frame * 0.03) * 5;

  const dims = type === "phone" ? { w: 280, h: 560, r: 36 }
    : type === "laptop" ? { w: 520, h: 340, r: 12 }
    : { w: 500, h: 340, r: 12 }; // browser

  return (
    <div style={{
      position: "absolute", left: x, top: y,
      transform: `translate(-50%, -50%) translateY(${ty + float}px) scale(${enter * s})`,
      opacity: op,
    }}>
      {/* Device bezel */}
      <div style={{
        width: dims.w, height: dims.h, borderRadius: dims.r,
        border: "3px solid rgba(255,255,255,0.15)",
        backgroundColor: "#111", overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        position: "relative",
      }}>
        {/* Top bar */}
        {type === "phone" && (
          <div style={{ height: 35, backgroundColor: "#1a1a1a", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ width: 60, height: 6, borderRadius: 3, backgroundColor: "#333" }} />
          </div>
        )}
        {type === "browser" && (
          <div style={{ height: 36, backgroundColor: "#1a1a1a", display: "flex", alignItems: "center", padding: "0 12px", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#ff5f56" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#ffbd2e" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#27ca3e" }} />
            <div style={{ flex: 1, marginLeft: 10, height: 20, borderRadius: 6, backgroundColor: "#2a2a2a" }} />
          </div>
        )}
        {/* Content area */}
        <div style={{ flex: 1, padding: type === "phone" ? 10 : 14, position: "relative", height: type === "phone" ? dims.h - 35 : dims.h - 36 }}>
          {children}
        </div>
      </div>
      {/* Laptop base */}
      {type === "laptop" && (
        <div style={{
          width: dims.w + 60, height: 16, borderRadius: "0 0 8px 8px",
          backgroundColor: "#222", marginLeft: -30, marginTop: -2,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }} />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// FEATURE CARD — icon + title + description
// ═══════════════════════════════════════════════════════════════
export const FeatureCard = ({ iconPath, title, description, color = "#8b5cf6", bg = "#1e1b4b", delay = 0, x = "50%", y = "50%", width: w = 320 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 150, mass: 0.8 } });
  const ty = interpolate(s, [0, 1], [60, 0]);
  const op = interpolate(s, [0, 1], [0, 1]);
  const glow = interpolate(Math.sin((frame - delay) * 0.05), [-1, 1], [0, 0.15]);
  return (
    <div style={{
      position: "absolute", left: x, top: y,
      transform: `translate(-50%, -50%) translateY(${ty}px)`,
      opacity: op, width: w,
    }}>
      <div style={{
        padding: 28, borderRadius: 20, backgroundColor: bg,
        boxShadow: `0 0 30px ${color}${Math.round(glow * 255).toString(16).padStart(2, "0")}`,
        border: `1px solid ${color}22`,
      }}>
        {iconPath && (
          <svg width="44" height="44" viewBox="0 0 24 24" fill={color} style={{ marginBottom: 16 }}><path d={iconPath} /></svg>
        )}
        <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 8, fontFamily: "Inter, system-ui, sans-serif" }}>{title}</div>
        <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.5, fontFamily: "Inter, system-ui, sans-serif" }}>{description}</div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CORNER BRACKETS — L-shaped decorative lines
// ═══════════════════════════════════════════════════════════════
export const CornerBrackets = ({ color = "#94a3b8", delay = 0, thickness = 3, length = 60, margin = 40 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 100, mass: 0.6 } });
  const len = interpolate(s, [0, 1], [0, length]);
  const op = interpolate(s, [0, 1], [0, 0.6]);
  const line = (top, left, bottom, right, w, h) => (
    <div style={{ position: "absolute", top, left, bottom, right, width: w, height: h, backgroundColor: color, opacity: op }} />
  );
  return (
    <>
      {line(margin, margin, undefined, undefined, len, thickness)}
      {line(margin, margin, undefined, undefined, thickness, len)}
      {line(undefined, undefined, margin, margin, len, thickness)}
      {line(undefined, undefined, margin, margin, thickness, len)}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
// LIGHT SWEEP — diagonal highlight bar moving across the frame
// ═══════════════════════════════════════════════════════════════
export const LightSweep = ({ speed = 1, opacity = 0.06, width: barWidth = 200 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const x = interpolate(frame * speed, [0, 300], [-barWidth, width + barWidth], { extrapolateRight: "extend" });
  return (
    <div style={{
      position: "absolute", width: barWidth, height: height * 2,
      background: `linear-gradient(to right, transparent, rgba(255,255,255,${opacity}), transparent)`,
      transform: `translateX(${x}px) rotate(25deg)`,
      transformOrigin: "center center", top: -height * 0.5,
    }} />
  );
};
