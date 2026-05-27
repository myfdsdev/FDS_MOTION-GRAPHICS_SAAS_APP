import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";

// Lazy so three.js ships in its own chunk — only the landing loads it.
const LightPillar = lazy(() => import("@/components/reactbits/LightPillar.jsx"));

const Spark = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </svg>
);
const Arrow = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const Sun = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </svg>
);
const Moon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

const Mark = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)" />
    <path d="M9 22V10h6.5a3.5 3.5 0 0 1 2 6.4L22 22h-3.4l-3.2-5H12v5z M12 14.5h3a1 1 0 1 0 0-2h-3z" fill="var(--accent-ink)" />
  </svg>
);

export default function RemotionLanding() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  return (
    <div className="remotion-landing" style={{ position: "relative", minHeight: "100vh", overflow: "hidden", fontFamily: '"Geist", sans-serif' }}>
      {/* WebGL backdrop */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.9 }}>
        <Suspense fallback={null}>
          <LightPillar
            topColor="#5227FF"
            bottomColor="#FF9FFC"
            intensity={0.9}
            rotationSpeed={0.25}
            glowAmount={0.006}
            pillarWidth={3.0}
            pillarHeight={0.4}
            noiseIntensity={0.4}
            mixBlendMode="screen"
            quality="low"
            onError={(msg) => toast.error(msg)}
          />
        </Suspense>
      </div>

      {/* Top bar */}
      <header style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Mark />
          <span style={{ fontWeight: 600, letterSpacing: "-0.01em", fontSize: 17 }}>
            re<span style={{ color: "var(--accent)" }}>·</span>motion
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggle} aria-label="Toggle theme" style={{ width: 36, height: 36, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1px solid var(--line)", color: "var(--muted)", cursor: "pointer" }}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
          <button onClick={() => navigate("/login")} style={{ padding: "9px 14px", borderRadius: 999, background: "transparent", border: "1px solid transparent", color: "var(--text)", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Sign in</button>
        </div>
      </header>

      {/* Centered hero */}
      <main style={{ position: "relative", zIndex: 2, minHeight: "calc(100vh - 80px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px 80px" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }} style={{ maxWidth: 760 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px 7px 10px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)", fontSize: 13, color: "var(--muted)", marginBottom: 28 }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: "var(--accent-15)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}><Spark /></span>
            Cinematic video, generated in seconds
          </div>

          <h1 style={{ margin: 0, fontSize: "clamp(44px, 8vw, 96px)", fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 0.98 }}>
            Direct cinema{" "}
            <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400 }}>from a prompt.</span>
          </h1>

          <p style={{ marginTop: 24, fontSize: 18, color: "var(--muted)", lineHeight: 1.5, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
            Type a scene. RE-MOTION writes the script, animates the storyboard, voices the narration, and scores the music — in under a minute.
          </p>

          <div style={{ marginTop: 36, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate("/register")} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 26px", borderRadius: 14, background: "var(--accent)", color: "var(--accent-ink)", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", boxShadow: "0 0 0 1px var(--accent-50), 0 18px 44px -12px var(--accent-55)" }}>
              Start free — 3 credits <Arrow />
            </motion.button>
            <button onClick={() => navigate("/login")} style={{ padding: "16px 24px", borderRadius: 14, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--line-2)", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 500 }}>
              Sign in
            </button>
          </div>

          <div style={{ marginTop: 30, fontSize: 13, color: "var(--muted)" }}>
            No credit card needed · Export to MP4
          </div>
        </motion.div>
      </main>
    </div>
  );
}
