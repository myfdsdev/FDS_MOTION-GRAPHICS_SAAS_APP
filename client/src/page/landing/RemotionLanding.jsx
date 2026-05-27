import React, { useRef, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useTheme } from "@/lib/theme";

// Lazy so three.js ships in its own chunk — only the landing loads it.
const LightPillar = lazy(() => import("@/components/reactbits/LightPillar.jsx"));

/* ============================ ICONS / BRAND ============================ */
const I = {
  spark: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>,
  arrow: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  arrowDown: (p) => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M6 13l6 6 6-6"/></svg>,
  play: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" {...p}><path d="M8 5v14l11-7z"/></svg>,
  star: (p) => <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" {...p}><path d="m12 2 2.9 6.9 7.1.6-5.4 4.7 1.7 7.1L12 17.7l-6.3 3.6 1.7-7.1L2 9.5l7.1-.6z"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  sun: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>,
  moon: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>,
  film: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/></svg>,
  mic: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>,
  music: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>,
  palette: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1-1-2 1-2 2-2h2a4 4 0 0 0 4-4 8 8 0 0 0-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8" r="1"/></svg>,
  bolt: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m13 2-9 12h7l-1 8 9-12h-7z"/></svg>,
  globe: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/></svg>,
  layers: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5M3 18l9 5 9-5"/></svg>,
  shield: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3 4 6v6a10 10 0 0 0 8 9 10 10 0 0 0 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>,
  twitter: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  github: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>,
  linkedin: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.34 18.34v-7.65H5.7v7.65zm-1.32-8.7a1.53 1.53 0 1 0 0-3.06 1.53 1.53 0 0 0 0 3.06zm11.32 8.7v-4.2c0-2.34-1.25-3.42-2.92-3.42-1.34 0-1.94.74-2.27 1.26v-1.08H10.5c.04.75 0 7.65 0 7.65h2.64v-4.27c0-.24.02-.47.09-.64.18-.47.62-.96 1.34-.96.95 0 1.32.72 1.32 1.77v4.1z"/></svg>,
};

const Mark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)" />
    <path d="M9 22V10h6.5a3.5 3.5 0 0 1 2 6.4L22 22h-3.4l-3.2-5H12v5z M12 14.5h3a1 1 0 1 0 0-2h-3z" fill="var(--accent-ink)" />
  </svg>
);

const Wordmark = ({ size = 17 }) => (
  <span style={{ fontWeight: 600, letterSpacing: "-0.01em", fontSize: size }}>
    re<span style={{ color: "var(--accent)" }}>·</span>motion
  </span>
);

// Empty media placeholder — real previews/video come later.
function Placeholder({ aspect = "16/9", label = "Preview", radius = 0 }) {
  return (
    <div style={{
      position: "relative", width: "100%", height: "100%", aspectRatio: aspect,
      borderRadius: radius,
      background: "linear-gradient(135deg, oklch(0.30 0.08 290) 0%, oklch(0.16 0.06 290) 60%, var(--bg-deep) 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.5,
        background: "radial-gradient(60% 60% at 50% 40%, var(--accent-15), transparent 70%)",
      }} />
      <span style={{
        fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase",
        color: "oklch(1 0 0 / 0.55)", fontFamily: '"Geist Mono", monospace',
      }}>{label}</span>
    </div>
  );
}

/* ============================ NAV ============================ */
function Nav({ go }) {
  const { theme, toggle } = useTheme();
  const linkStyle = { color: "var(--muted)", fontSize: 14, fontWeight: 500, padding: "10px 14px", borderRadius: 999, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
      padding: "18px 28px", backdropFilter: "blur(14px)",
      background: "linear-gradient(to bottom, var(--bg), transparent)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Mark size={26} /><Wordmark /></div>
      <nav style={{ display: "flex", alignItems: "center", gap: 2, padding: 6, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)" }}>
        <span style={{ ...linkStyle, color: "var(--text)" }}>Director</span>
        <span style={linkStyle}>Showcase</span>
        <span style={linkStyle}>Templates</span>
        <span style={linkStyle}>Pricing</span>
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={toggle} aria-label="Toggle theme" style={{ width: 36, height: 36, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--line)", color: "var(--muted)", cursor: "pointer" }}>
          {theme === "dark" ? <I.sun /> : <I.moon />}
        </button>
        <button onClick={() => go("/login")} style={{ padding: "9px 14px", borderRadius: 999, background: "transparent", border: "1px solid transparent", color: "var(--text)", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Sign in</button>
        <button onClick={() => go("/register")} style={{ padding: "10px 16px", borderRadius: 999, background: "var(--accent)", color: "var(--accent-ink)", border: "none", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, boxShadow: "0 0 0 1px var(--accent-50), 0 8px 24px -8px var(--accent-55)" }}>Start free</button>
      </div>
    </header>
  );
}

/* ============================ HERO ============================ */
function Hero({ go }) {
  return (
    <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 100, paddingBottom: 60, overflow: "hidden", perspective: 1600 }}>
      {/* React Bits LightPillar — WebGL hero backdrop */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.9 }}>
        <Suspense fallback={null}>
          <LightPillar
            topColor="#5227FF"
            bottomColor="#FF9FFC"
            intensity={1.0}
            rotationSpeed={0.3}
            glowAmount={0.006}
            pillarWidth={3.0}
            pillarHeight={0.4}
            noiseIntensity={0.4}
            mixBlendMode="screen"
          />
        </Suspense>
      </div>

      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", fontSize: "min(45vw, 720px)", fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 1, color: "transparent", WebkitTextStroke: "1px oklch(1 0 0 / 0.05)", userSelect: "none", pointerEvents: "none", fontFamily: '"Instrument Serif", serif', fontStyle: "italic", zIndex: 0 }}>rm</div>

      <div style={{ position: "relative", zIndex: 2, maxWidth: 1200, margin: "0 auto", padding: "0 28px", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 56, alignItems: "center" }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px 7px 10px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)", fontSize: 13, color: "var(--text)", marginBottom: 28 }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: "var(--accent-15)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}><I.spark /></span>
            <span style={{ color: "var(--muted)" }}>Director 2.0 is live</span>
            <span style={{ color: "var(--dim)" }}>·</span>
            <span style={{ color: "var(--accent)" }}>Try free →</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(48px, 7vw, 104px)", fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 0.98 }}>
            Direct cinema<br />
            <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400, letterSpacing: "-0.015em" }}>from a prompt.</span>
          </h1>
          <p style={{ marginTop: 26, fontSize: 19, color: "var(--muted)", maxWidth: 480, lineHeight: 1.5 }}>
            Type a scene. Pick a template. RE-MOTION writes the script, animates the storyboard, voices the narration, scores the music — all in under a minute.
          </p>
          <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => go("/register")} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 24px", borderRadius: 14, background: "var(--accent)", color: "var(--accent-ink)", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", boxShadow: "0 0 0 1px var(--accent-50), 0 18px 44px -12px var(--accent-55)" }}>
              Start free — 3 credits <I.arrow />
            </motion.button>
            <button onClick={() => go("/register")} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 22px", borderRadius: 14, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--line-2)", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 500 }}>
              <I.play /> Watch the reel <span style={{ color: "var(--dim)", marginLeft: 4 }}>0:42</span>
            </button>
          </div>
          <div style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 18, fontSize: 13, color: "var(--muted)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", gap: 1, color: "oklch(0.85 0.16 85)" }}><I.star /><I.star /><I.star /><I.star /><I.star /></span>
            <span><b style={{ color: "var(--text)" }}>4.9</b> · 1,820 reviews</span>
            <span style={{ width: 1, height: 14, background: "var(--line-2)" }} />
            <span><b style={{ color: "var(--text)" }}>62k+</b> directors</span>
          </div>
        </motion.div>

        {/* floating card stack — media placeholders */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }} style={{ position: "relative", height: 540, transformStyle: "preserve-3d" }}>
          <div style={{ position: "absolute", right: 40, top: 0, width: "85%", height: 280, borderRadius: 18, overflow: "hidden", border: "1px solid var(--line-2)", background: "var(--bg-deep)", boxShadow: "0 30px 80px -30px oklch(0 0 0 / 0.7)", transform: "translateZ(-80px) translateX(20px) translateY(-10px) rotate(3deg)" }}>
            <Placeholder aspect="16/9" label="Storyboard" />
          </div>
          <div style={{ position: "absolute", left: 0, top: 120, width: "70%", height: 220, borderRadius: 16, overflow: "hidden", border: "1px solid var(--line-2)", background: "var(--bg-deep)", boxShadow: "0 25px 60px -25px oklch(0 0 0 / 0.7)", transform: "translateZ(0px) rotate(-2deg)" }}>
            <Placeholder aspect="16/9" label="Palette" />
          </div>
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", left: 40, bottom: 0, right: 0, padding: 22, borderRadius: 20, background: "linear-gradient(to bottom, oklch(0.22 0.06 290 / 0.92), oklch(0.18 0.06 290 / 0.85))", border: "1px solid var(--line-2)", backdropFilter: "blur(12px)", boxShadow: "0 1px 0 oklch(1 0 0 / 0.06) inset, 0 40px 100px -30px oklch(0 0 0 / 0.85), 0 0 0 1px var(--accent-12)", transform: "translateZ(80px)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {[{ l: "Template", v: "Title Reveal" }, { l: "Voice", v: "Eli · warm" }, { l: "Music", v: "Ambient" }, { v: "30s · 1080p" }].map((c, i) => (
                <span key={i} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 999, background: i === 0 ? "var(--accent-12)" : "var(--surface-2)", color: i === 0 ? "var(--accent)" : "var(--muted)", border: `1px solid ${i === 0 ? "var(--accent-35)" : "var(--line)"}`, fontFamily: '"Geist Mono", monospace' }}>
                  {c.l && <span style={{ color: "var(--dim)" }}>{c.l}: </span>}{c.v}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.5, color: "var(--text)", minHeight: 70, marginBottom: 14 }}>
              A 30-second product reveal of a matte-black ceramic kettle, slow dolly-in, warm morning light, soft ambient pad rising on the cut.
              <span style={{ display: "inline-block", width: 8, height: 16, background: "var(--accent)", verticalAlign: "middle", marginLeft: 2, animation: "pulse-dot 1.4s steps(2) infinite" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--dim)", fontFamily: '"Geist Mono", monospace' }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)", animation: "pulse-dot 2s ease-in-out infinite" }} />rendering · 38%
              </span>
              <span>1 credit</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--dim)", fontFamily: '"Geist Mono", monospace' }}>
        Scroll <I.arrowDown />
      </div>
    </section>
  );
}

/* ============================ PINNED REVEAL ============================ */
function PinnedReveal() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const scale = useTransform(scrollYProgress, [0, 0.6], [0.7, 1.25]);
  const wordOpacity = useTransform(scrollYProgress, [0, 0.15], [0, 1]);
  const subOpacity = useTransform(scrollYProgress, [0.45, 0.7], [0, 1]);
  const subY = useTransform(scrollYProgress, [0.45, 0.7], [30, 0]);
  return (
    <section ref={ref} style={{ position: "relative", height: "260vh" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "linear-gradient(to bottom, var(--bg) 0%, var(--bg-deep) 100%)" }}>
        <div style={{ position: "absolute", top: "18%", fontSize: 12, letterSpacing: "0.4em", textTransform: "uppercase", color: "var(--accent)", fontFamily: '"Geist Mono", monospace' }}>— Frame 001 / 1,840 —</div>
        <motion.div style={{ scale, opacity: wordOpacity, textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16vw", letterSpacing: "-0.06em", lineHeight: 0.85, color: "var(--text)", fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400 }}>one prompt.</h2>
          <h2 style={{ margin: "-0.2em 0 0", fontSize: "22vw", fontWeight: 800, letterSpacing: "-0.07em", lineHeight: 0.82, background: "linear-gradient(180deg, var(--accent) 0%, oklch(0.55 0.18 295) 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>MOTION.</h2>
        </motion.div>
        <motion.div style={{ opacity: subOpacity, y: subY, position: "absolute", bottom: "18%", maxWidth: 540, textAlign: "center", color: "var(--muted)", fontSize: 18, lineHeight: 1.5, padding: "0 28px" }}>
          A director sits inside the model. It picks the lens, the cut, the score — you just say the scene.
        </motion.div>
        <div style={{ position: "absolute", left: 28, top: 100, fontFamily: '"Geist Mono", monospace', fontSize: 11, color: "var(--dim)", letterSpacing: "0.05em" }}>LAT 38.7223° N<br />LON 9.1393° W<br />LISBON · STUDIO 04</div>
        <div style={{ position: "absolute", right: 28, top: 100, textAlign: "right", fontFamily: '"Geist Mono", monospace', fontSize: 11, color: "var(--dim)", letterSpacing: "0.05em" }}>REC 00:00:14:08<br />FPS 24.000<br />4K · ProRes 422</div>
        <div style={{ position: "absolute", left: 28, bottom: 28, fontFamily: '"Geist Mono", monospace', fontSize: 11, color: "var(--dim)" }}>◉ REC</div>
      </div>
    </section>
  );
}

/* ============================ SCRUB SEQUENCE ============================ */
function ScrubSequence() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", setP);
  const steps = [
    { t: "Scene assembly", d: "Storyboard frames generated from your prompt." },
    { t: "Camera & motion", d: "Lens, easing, parallax — driven by shot grammar." },
    { t: "Light & color", d: "Dawn light blooms in. Grading matches your brand." },
    { t: "Final render", d: "Score lifts on the cut. Export-ready in 4K." },
  ];
  const active = Math.min(steps.length - 1, Math.floor(p * steps.length));
  return (
    <section ref={ref} style={{ position: "relative", height: "300vh" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ width: "100%", maxWidth: 1400, padding: "0 40px", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 56, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--dim)", fontFamily: '"Geist Mono", monospace', marginBottom: 18, display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--accent)" }}>02</span><span style={{ width: 18, height: 1, background: "var(--line-2)" }} />Render
            </div>
            <h2 style={{ margin: 0, fontSize: "clamp(36px, 4.4vw, 64px)", fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.02 }}>
              A scene <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400 }}>directing itself.</span>
            </h2>
            <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 18 }}>
              {steps.map((s, i) => {
                const on = i === active;
                return (
                  <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 16px", borderRadius: 12, background: on ? "var(--accent-12)" : "var(--surface)", border: `1px solid ${on ? "var(--accent-35)" : "var(--line)"}`, opacity: on ? 1 : 0.5, transition: "opacity .3s, background .3s, border-color .3s" }}>
                    <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 999, background: on ? "var(--accent)" : "var(--surface-2)", border: `1px solid ${on ? "var(--accent)" : "var(--line-2)"}`, color: on ? "var(--accent-ink)" : "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"Geist Mono", monospace', fontSize: 12, fontWeight: 600, transition: "all .3s" }}>0{i + 1}</span>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 15 }}>{s.t}</div>
                      <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 4, lineHeight: 1.5 }}>{s.d}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ position: "relative", width: "100%", borderRadius: 22, overflow: "hidden", border: "1px solid var(--line-2)", boxShadow: "0 40px 100px -30px oklch(0 0 0 / 0.7), 0 0 0 1px var(--accent-04)" }}>
            <Placeholder aspect="16/9" label="Scene render" />
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontFamily: '"Geist Mono", monospace', letterSpacing: "0.1em", color: "oklch(1 0 0 / 0.85)", background: "oklch(0 0 0 / 0.4)", padding: "4px 8px", borderRadius: 4, backdropFilter: "blur(6px)" }}>● REC · {(p * 30).toFixed(2)}s</span>
                <span style={{ fontSize: 10, fontFamily: '"Geist Mono", monospace', letterSpacing: "0.1em", color: "oklch(1 0 0 / 0.85)", background: "oklch(0 0 0 / 0.4)", padding: "4px 8px", borderRadius: 4, backdropFilter: "blur(6px)" }}>4K · 24fps</span>
              </div>
              <div>
                <div style={{ height: 3, background: "oklch(0 0 0 / 0.4)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ height: "100%", width: `${p * 100}%`, background: "var(--accent)", boxShadow: "0 0 10px var(--accent-55)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: '"Geist Mono", monospace', color: "oklch(1 0 0 / 0.7)" }}>
                  <span>00:00</span><span>FRAME {Math.round(p * 720)} / 720</span><span>00:30</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ CARD DECK (rotating) ============================ */
function CardDeck() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotate = useTransform(scrollYProgress, [0, 1], [0, -300]);
  const templates = ["Title Reveal", "Bullet Story", "Brand Teaser", "Product Reveal", "Quote Card", "Lower Third", "Recipe Reel", "Stats Counter"];
  const durs = ["0:15", "0:30", "0:10", "0:30", "0:15", "0:08", "0:60", "0:20"];
  return (
    <section ref={ref} style={{ position: "relative", padding: "140px 0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 70 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--accent)", fontFamily: '"Geist Mono", monospace', marginBottom: 18 }}>
            <span style={{ width: 18, height: 1, background: "var(--accent)" }} />120+ templates<span style={{ width: 18, height: 1, background: "var(--accent)" }} />
          </div>
          <h2 style={{ margin: 0, fontSize: "clamp(36px, 5vw, 72px)", fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.02 }}>
            Pick a template. <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400 }}>Open the lens.</span>
          </h2>
        </div>
        <div style={{ perspective: 1600, minHeight: 560 }}>
          <motion.div style={{ position: "relative", height: 540, transformStyle: "preserve-3d", rotateY: rotate }}>
            {templates.map((name, i) => {
              const angle = (360 / templates.length) * i;
              return (
                <div key={i} style={{ position: "absolute", left: "50%", top: 0, width: 320, height: 460, marginLeft: -160, transformStyle: "preserve-3d", transform: `rotateY(${angle}deg) translateZ(560px)` }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: 18, overflow: "hidden", background: "linear-gradient(to bottom, oklch(0.20 0.06 290), oklch(0.13 0.06 290))", border: "1px solid var(--line-2)", boxShadow: "0 30px 80px -30px oklch(0 0 0 / 0.7)", display: "flex", flexDirection: "column" }}>
                    <div style={{ aspectRatio: "16/10", borderBottom: "1px solid var(--line)" }}><Placeholder aspect="16/10" label={`#${i + 1}`} /></div>
                    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 10, fontFamily: '"Geist Mono", monospace', letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 8 }}>Template · {String(i + 1).padStart(2, "0")}</div>
                        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{name}</h3>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <span style={{ fontSize: 12, color: "var(--muted)", padding: "4px 10px", borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--line)", fontFamily: '"Geist Mono", monospace' }}>{durs[i]}</span>
                        <span style={{ padding: "8px 14px", borderRadius: 999, background: "var(--accent)", color: "var(--accent-ink)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Use →</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
        <div style={{ textAlign: "center", marginTop: 40, fontSize: 13, color: "var(--dim)", fontFamily: '"Geist Mono", monospace', letterSpacing: "0.06em" }}>Scroll to rotate · 8 of 120+ shown</div>
      </div>
    </section>
  );
}

/* ============================ HORIZONTAL SHOWCASE ============================ */
function HorizontalShowcase({ go }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["2%", "-72%"]);
  const items = [
    { tag: "16:9", title: "Product reveal — ceramic kettle, dawn light" },
    { tag: "9:16", title: "Onboarding explainer — budgeting app" },
    { tag: "1:1", title: "Top-5 facts — deep sea creatures" },
    { tag: "16:9", title: "Brand teaser — glitch & chrome" },
    { tag: "9:16", title: "Recipe reel — brown butter cookies" },
    { tag: "16:9", title: "Real estate walk-thru, golden hour" },
  ];
  return (
    <section ref={ref} style={{ position: "relative", height: "420vh" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ padding: "0 40px", marginBottom: 30 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", maxWidth: 1400, margin: "0 auto" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--dim)", fontFamily: '"Geist Mono", monospace', marginBottom: 14 }}>
                <span style={{ color: "var(--accent)" }}>03</span><span style={{ width: 18, height: 1, background: "var(--line-2)" }} />Recently directed
              </div>
              <h2 style={{ margin: 0, fontSize: "clamp(32px, 4.4vw, 56px)", fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.02 }}>Made this morning.</h2>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", padding: "8px 12px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent)", animation: "pulse-dot 2s ease-in-out infinite" }} />
              <span style={{ color: "var(--text)", fontWeight: 500 }}>1,284</span> renders in the last hour
            </span>
          </div>
        </div>
        <motion.div style={{ display: "flex", gap: 28, padding: "0 40px", x, willChange: "transform" }}>
          {items.map((it, i) => (
            <div key={i} style={{ flex: "0 0 auto", width: it.tag === "9:16" ? 340 : it.tag === "1:1" ? 480 : 720, aspectRatio: it.tag === "9:16" ? "9/16" : it.tag === "1:1" ? "1/1" : "16/9", borderRadius: 18, overflow: "hidden", border: "1px solid var(--line-2)", position: "relative", boxShadow: "0 30px 80px -30px oklch(0 0 0 / 0.7)" }}>
              <Placeholder aspect={it.tag === "9:16" ? "9/16" : it.tag === "1:1" ? "1/1" : "16/9"} label={it.tag} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, oklch(0 0 0 / 0.8) 0%, transparent 50%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 18px", color: "oklch(1 0 0 / 0.95)" }}>
                <div style={{ fontSize: 10, fontFamily: '"Geist Mono", monospace', letterSpacing: "0.15em", textTransform: "uppercase", color: "oklch(1 0 0 / 0.6)", marginBottom: 6 }}>Frame · 0{i + 1}</div>
                <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>{it.title}</div>
              </div>
            </div>
          ))}
          <div style={{ flex: "0 0 auto", width: 400, aspectRatio: "16/9", borderRadius: 18, background: "linear-gradient(135deg, var(--accent-15), transparent)", border: "1px dashed var(--accent-35)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: "var(--accent)" }}>
            <span style={{ fontSize: 13, fontFamily: '"Geist Mono", monospace', letterSpacing: "0.15em", textTransform: "uppercase" }}>Direct yours</span>
            <h3 style={{ margin: 0, fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text)", textAlign: "center" }}>What's <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400 }}>your scene?</span></h3>
            <button onClick={() => go("/register")} style={{ marginTop: 10, padding: "12px 20px", borderRadius: 12, background: "var(--accent)", color: "var(--accent-ink)", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Start free →</button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================ FEATURES ============================ */
function Features() {
  const features = [
    { icon: <I.film />, title: "Cinematic motion", body: "Dolly, push, parallax — driven by shot grammar, not just frames." },
    { icon: <I.mic />, title: "200+ voices", body: "40 languages, four accent variants each, instant clone from 60s." },
    { icon: <I.music />, title: "Adaptive score", body: "Music stretches and resolves around your cuts. Royalty-cleared." },
    { icon: <I.palette />, title: "Brand kits", body: "Drop a logo. Lock the colors. Every render stays on-brand." },
    { icon: <I.bolt />, title: "Real-time render", body: "First draft in 8 seconds. Final export in under a minute." },
    { icon: <I.globe />, title: "API & batch", body: "REST + webhooks. Spin up 10k personalized variants overnight." },
    { icon: <I.layers />, title: "Stem export", body: "Audio, VO, music, SFX — every layer downloadable separately." },
    { icon: <I.shield />, title: "C2PA signed", body: "Every render carries cryptographic content credentials." },
  ];
  return (
    <section style={{ padding: "120px 28px", position: "relative" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 56, maxWidth: 720 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--accent)", fontFamily: '"Geist Mono", monospace', marginBottom: 18 }}>
            <span>04</span><span style={{ width: 18, height: 1, background: "var(--accent)" }} />The toolkit
          </div>
          <h2 style={{ margin: 0, fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.02 }}>
            A full director's chair, <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400 }}>in one tab.</span>
          </h2>
        </div>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: (i % 4) * 0.06 }} whileHover={{ y: -4 }} style={{ padding: 24, borderRadius: 16, background: "linear-gradient(to bottom, oklch(0.20 0.06 290 / 0.5), oklch(0.16 0.06 290 / 0.3))", border: "1px solid var(--line)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-12)", color: "var(--accent)", border: "1px solid var(--accent-35)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{f.icon}</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.55 }}>{f.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ PRICING ============================ */
function Pricing({ go }) {
  const packs = [
    { name: "Starter", price: "$27", credits: 30, per: "$0.90 / credit", features: ["30 video credits", "1080p MP4 export", "All 120+ templates", "All voices & music", "Commercial license"], cta: "Get Starter" },
    { name: "Pro", price: "$67", credits: 100, per: "$0.67 / credit", featured: true, features: ["100 video credits", "1080p MP4 + ProRes", "All templates & voices", "Brand kits unlocked", "Priority queue", "30-day refund"], cta: "Get Pro" },
    { name: "Agency", price: "$197", credits: 500, per: "$0.39 / credit", features: ["500 video credits", "1080p + ProRes + WebM", "Stem-level export", "API access (beta)", "5 brand kits", "30-day refund"], cta: "Get Agency" },
  ];
  return (
    <section style={{ padding: "120px 28px", position: "relative" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--accent)", fontFamily: '"Geist Mono", monospace', marginBottom: 18 }}>
            <span style={{ width: 18, height: 1, background: "var(--accent)" }} />05 — Credits<span style={{ width: 18, height: 1, background: "var(--accent)" }} />
          </div>
          <h2 style={{ margin: 0, fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.02 }}>
            Pay once. <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400 }}>Never expires.</span>
          </h2>
          <p style={{ marginTop: 16, color: "var(--muted)", fontSize: 17, maxWidth: 540, margin: "16px auto 0" }}>One credit = one finished video. Buy when you need them. Use them whenever.</p>
        </div>
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {packs.map((p, i) => (
            <div key={i} style={{ position: "relative", padding: 28, borderRadius: 20, background: p.featured ? "linear-gradient(to bottom, oklch(0.22 0.06 290 / 0.95), oklch(0.18 0.06 290 / 0.85))" : "linear-gradient(to bottom, oklch(0.20 0.06 290 / 0.5), oklch(0.17 0.06 290 / 0.3))", border: `1px solid ${p.featured ? "var(--accent-35)" : "var(--line)"}`, boxShadow: p.featured ? "0 30px 80px -40px var(--accent-50), 0 0 0 1px var(--accent-12)" : "none", display: "flex", flexDirection: "column", gap: 16 }}>
              {p.featured && <span style={{ position: "absolute", top: -10, left: 24, padding: "4px 10px", borderRadius: 999, background: "var(--accent)", color: "var(--accent-ink)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Most popular</span>}
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{p.name}</h3>
              <div>
                <div style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1 }}>{p.price}</div>
                <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13, fontFamily: '"Geist Mono", monospace' }}>{p.credits} credits · {p.per}</div>
              </div>
              <button onClick={() => go("/register")} style={{ padding: "12px 16px", borderRadius: 12, fontFamily: "inherit", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer", border: "none", background: p.featured ? "var(--accent)" : "var(--surface-3)", color: p.featured ? "var(--accent-ink)" : "var(--text)", boxShadow: p.featured ? "0 0 0 1px var(--accent-50), 0 14px 36px -12px var(--accent-55)" : "0 0 0 1px var(--line-2)" }}>{p.cta} →</button>
              <div style={{ height: 1, background: "var(--line)" }} />
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {p.features.map((f, j) => (<li key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--text)" }}><span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}><I.check /></span><span>{f}</span></li>))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 28, textAlign: "center", color: "var(--dim)", fontSize: 13.5 }}>Secure checkout · 30-day money-back guarantee · Credits never expire</p>
      </div>
    </section>
  );
}

/* ============================ FINAL CTA + FOOTER ============================ */
function FinalCTA({ go }) {
  return (
    <section style={{ padding: "80px 28px 100px", position: "relative" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative", overflow: "hidden", borderRadius: 28, background: "linear-gradient(135deg, oklch(0.22 0.06 290) 0%, oklch(0.14 0.06 290) 100%)", border: "1px solid var(--line-2)", padding: "80px 48px", boxShadow: "0 40px 100px -30px oklch(0 0 0 / 0.7)" }}>
        <div aria-hidden style={{ position: "absolute", right: -120, top: -120, width: 460, height: 460, borderRadius: 999, background: "radial-gradient(closest-side, var(--accent-35), transparent 70%)", filter: "blur(20px)", pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", left: -160, bottom: -160, width: 380, height: 380, borderRadius: 999, background: "radial-gradient(closest-side, oklch(0.55 0.18 295 / 0.4), transparent 70%)", filter: "blur(20px)", pointerEvents: "none" }} />
        <div style={{ position: "relative", textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--accent)", fontFamily: '"Geist Mono", monospace', marginBottom: 18 }}>Roll camera</div>
          <h2 style={{ margin: 0, fontSize: "clamp(40px, 5.5vw, 72px)", fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.02 }}>
            Your first scene is <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400 }}>eight seconds away.</span>
          </h2>
          <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 17, lineHeight: 1.5 }}>Free draft, no card needed. Three credits on the house.</p>
          <div style={{ marginTop: 36, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => go("/register")} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 26px", borderRadius: 14, background: "var(--accent)", color: "var(--accent-ink)", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", boxShadow: "0 0 0 1px var(--accent-50), 0 18px 44px -12px var(--accent-55)" }}>Start free → <I.arrow /></motion.button>
            <button onClick={() => go("/register")} style={{ padding: "16px 24px", borderRadius: 14, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--line-2)", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 500 }}>View templates</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    { h: "Product", links: ["Director", "Templates", "Voices", "Pricing", "Changelog"] },
    { h: "Resources", links: ["Docs", "API", "Style guide", "Status", "Roadmap"] },
    { h: "Company", links: ["About", "Customers", "Careers", "Press", "Contact"] },
    { h: "Legal", links: ["Terms", "Privacy", "Provenance", "Acceptable use"] },
  ];
  return (
    <footer style={{ borderTop: "1px solid var(--line)", background: "linear-gradient(to bottom, transparent, oklch(0.10 0.06 290))", padding: "72px 28px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gap: 48, gridTemplateColumns: "1.4fr repeat(4, 1fr)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Mark size={32} /><Wordmark size={19} /></div>
            <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 14, lineHeight: 1.6, maxWidth: 320 }}>Direct cinematic motion from a single prompt. Built for everyone with a story and not enough hours.</p>
            <div style={{ marginTop: 22, display: "flex", gap: 8 }}>{[I.twitter, I.github, I.linkedin].map((Ic, i) => (<button key={i} style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic /></button>))}</div>
          </div>
          {cols.map((c, i) => (
            <div key={i}>
              <h4 style={{ margin: 0, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--accent)", fontFamily: '"Geist Mono", monospace', fontWeight: 500 }}>{c.h}</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>{c.links.map((l, j) => (<li key={j} style={{ color: "var(--muted)", fontSize: 14, cursor: "pointer" }}>{l}</li>))}</ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", color: "var(--dim)", fontSize: 13 }}>
          <span>© 2026 RE-MOTION Studio</span>
          <div style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, letterSpacing: "0.05em" }}>Made with ☕ &amp; cuts</div>
        </div>
        <div style={{ marginTop: 40, fontSize: "clamp(80px, 20vw, 280px)", fontWeight: 700, letterSpacing: "-0.06em", lineHeight: 0.9, color: "transparent", WebkitTextStroke: "1px var(--line-2)", textAlign: "center", userSelect: "none", fontFamily: '"Instrument Serif", serif', fontStyle: "italic" }}>re·motion</div>
      </div>
    </footer>
  );
}

/* ============================ ROOT ============================ */
export default function RemotionLanding() {
  const navigate = useNavigate();
  const go = (path) => navigate(path);
  return (
    <div className="remotion-landing" style={{ fontFamily: '"Geist", sans-serif', minHeight: "100vh", overflowX: "hidden" }}>
      <Nav go={go} />
      <Hero go={go} />
      <PinnedReveal />
      <ScrubSequence />
      <CardDeck />
      <HorizontalShowcase go={go} />
      <Features />
      <Pricing go={go} />
      <FinalCTA go={go} />
      <Footer />
    </div>
  );
}
