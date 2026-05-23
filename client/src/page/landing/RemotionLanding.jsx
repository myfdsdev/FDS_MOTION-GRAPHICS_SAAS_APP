import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/lib/theme";

/* ============================ ICONS / BRAND ============================ */
const I = {
  spark: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>,
  clock: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  ratio: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="6" width="18" height="12" rx="2"/></svg>,
  image: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg>,
  doc: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>,
  film: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/></svg>,
  palette: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1-1-2 1-2 2-2h2a4 4 0 0 0 4-4 8 8 0 0 0-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8" r="1"/></svg>,
  list: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 6h13M8 12h13M8 18h13"/><rect x="3" y="5" width="2.5" height="2.5" rx="0.5"/><rect x="3" y="11" width="2.5" height="2.5" rx="0.5"/><rect x="3" y="17" width="2.5" height="2.5" rx="0.5"/></svg>,
  mic: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>,
  music: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>,
  bolt: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m13 2-9 12h7l-1 8 9-12h-7z"/></svg>,
  chevron: (p) => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  sun: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>,
  moon: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>,
  star: (p) => <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" {...p}><path d="m12 2 2.9 6.9 7.1.6-5.4 4.7 1.7 7.1L12 17.7l-6.3 3.6 1.7-7.1L2 9.5l7.1-.6z"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  wand: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m4 20 12-12M14 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1zM19 13l.7 1.5L21 15l-1.3.5L19 17l-.7-1.5L17 15l1.3-.5z"/></svg>,
  arrow: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  play: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" {...p}><path d="M8 5v14l11-7z"/></svg>,
  globe: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/></svg>,
  shield: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3 4 6v6a10 10 0 0 0 8 9 10 10 0 0 0 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>,
  team: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M15 20a4 4 0 0 1 6-3"/></svg>,
  download: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>,
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

const pillBtn = {
  padding: "9px 14px", borderRadius: 999,
  background: "transparent", border: "1px solid transparent",
  color: "var(--muted)", fontSize: 13.5, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
};
const iconBtn = {
  width: 36, height: 36, borderRadius: 999,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "1px solid var(--line)",
  color: "var(--muted)", cursor: "pointer",
};

function Eyebrow({ children, num }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--dim)", fontFamily: '"Geist Mono", monospace', marginBottom: 18 }}>
      {num && <span style={{ color: "var(--accent)" }}>{num}</span>}
      <span style={{ width: 18, height: 1, background: "var(--line-2)" }} />
      {children}
    </div>
  );
}

function SectionTitle({ children, accent }) {
  return (
    <h2 style={{ margin: 0, fontSize: "clamp(32px, 4.2vw, 56px)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05, maxWidth: 820 }}>
      {children}
      {accent && (<>{" "}<span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400, letterSpacing: "-0.01em" }}>{accent}</span></>)}
    </h2>
  );
}

/* ============================ NAV ============================ */
function Nav({ go }) {
  const { theme, toggle } = useTheme();
  const linkStyle = { color: "var(--muted)", fontSize: 14, fontWeight: 500, padding: "10px 14px", borderRadius: 999, cursor: "pointer", transition: "color .15s, background .15s", display: "inline-flex", alignItems: "center", gap: 6 };
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "20px 28px", backdropFilter: "blur(14px)", background: "linear-gradient(to bottom, var(--bg), transparent)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Mark size={26} /><Wordmark />
      </div>
      <nav style={{ display: "flex", alignItems: "center", gap: 2, padding: 6, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)" }}>
        <span style={{ ...linkStyle, color: "var(--text)", background: "var(--surface-2)" }}>Discover</span>
        <span style={{ ...linkStyle, position: "relative" }}>Director<sup style={{ position: "absolute", top: -2, right: -8, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", background: "var(--info)", color: "oklch(0.16 0.04 240)", padding: "2px 5px", borderRadius: 4, lineHeight: 1 }}>NEW</sup></span>
        <span style={linkStyle}>Motion <I.chevron /></span>
        <span style={linkStyle}>Scenes</span>
        <span style={linkStyle}>Voices <I.chevron /></span>
        <span style={linkStyle}>Pricing</span>
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
        <button style={iconBtn} aria-label="Toggle theme" onClick={toggle} title={theme === "dark" ? "Light mode" : "Dark mode"}>
          {theme === "dark" ? <I.sun /> : <I.moon />}
        </button>
        <button style={{ ...pillBtn, color: "var(--text)" }} onClick={() => go("/login")}>Sign in</button>
        <button style={{ ...pillBtn, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 600, boxShadow: "0 0 0 1px var(--accent-40), 0 8px 24px -8px var(--accent-50)" }} onClick={() => go("/register")}>
          Start creating
        </button>
      </div>
    </header>
  );
}

/* ============================ HERO ============================ */
function Badge() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px 7px 10px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)", fontSize: 13, color: "var(--text)" }}>
      <span style={{ width: 22, height: 22, borderRadius: 999, background: "var(--accent-15)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}><I.spark /></span>
      <span style={{ color: "var(--muted)" }}>Cinematic motion, generated in</span><span>seconds</span>
    </div>
  );
}

function Headline() {
  return (
    <div style={{ textAlign: "center", marginTop: 22 }}>
      <h1 style={{ margin: 0, fontSize: "clamp(40px, 6vw, 80px)", fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.02 }}>
        Direct your next video{" "}
        <span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400, letterSpacing: "-0.01em" }}>in one prompt.</span>
      </h1>
      <p style={{ marginTop: 18, fontSize: 18, color: "var(--muted)", maxWidth: 620, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
        Type a scene. RE-MOTION drafts the storyboard, animation, narration and score — ready to refine in the timeline.
      </p>
    </div>
  );
}

function Chip({ icon, label, value, dropdown, active }) {
  return (
    <button style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 999, background: active ? "var(--accent-12)" : "var(--surface-2)", border: `1px solid ${active ? "var(--accent-35)" : "var(--line)"}`, color: active ? "var(--accent)" : "var(--text)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}>
      <span style={{ color: active ? "var(--accent)" : "var(--muted)", display: "inline-flex" }}>{icon}</span>
      <span style={{ color: active ? "var(--accent)" : "var(--muted)", fontWeight: 400 }}>{label}</span>
      {value && <span>{value}</span>}
      {dropdown && <I.chevron style={{ opacity: 0.5, marginLeft: 1 }} />}
    </button>
  );
}

function PromptCard({ go }) {
  const [text, setText] = useState("A 30-second product reveal of a matte-black ceramic kettle, slow dolly-in, warm morning light, ambient pad");
  return (
    <div style={{ marginTop: 44, borderRadius: 22, background: "var(--surface-2)", border: "1px solid var(--line-2)", boxShadow: "0 30px 80px -30px oklch(0 0 0 / 0.5), 0 0 0 1px var(--accent-04)", padding: 22 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Chip icon={<I.clock />} label="Length" value="30s" dropdown />
        <Chip icon={<I.ratio />} label="Ratio" value="16:9" dropdown />
        <Chip icon={<I.image />} label="Look" value="Cinematic" dropdown active />
        <Chip icon={<I.doc />} label="Brief" />
        <Chip icon={<I.film />} label="Scenes" value="6" dropdown />
        <Chip icon={<I.palette />} label="Palette" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        <Chip icon={<I.list />} label="Outline" />
        <Chip icon={<I.mic />} label="Narration" value="Eli · warm" dropdown />
        <Chip icon={<I.music />} label="Score" value="Ambient" dropdown />
        <Chip icon={<I.bolt />} label="SFX" />
      </div>
      <div style={{ marginTop: 18 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Describe a scene, a story, or paste a script…"
          style={{ width: "100%", resize: "none", background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 17, lineHeight: 1.55, fontFamily: "inherit", padding: "6px 2px", caretColor: "var(--accent)" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--dim)", fontFamily: '"Geist Mono", monospace' }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 8, background: "var(--surface-3)", border: "1px solid var(--line)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }} /><span>auto-storyboard</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={iconBtn} title="Surprise me" onClick={() => go("/register")}><I.wand /></button>
          <button onClick={() => go("/register")} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 18px", borderRadius: 12, background: "var(--accent)", color: "var(--accent-ink)", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", boxShadow: "0 0 0 1px var(--accent-50), 0 14px 36px -12px var(--accent-55)" }}>
            Generate video <I.arrow />
          </button>
        </div>
      </div>
    </div>
  );
}

const Sep = () => <span style={{ width: 1, height: 18, background: "var(--line)" }} />;
function Trust() {
  return (
    <div style={{ marginTop: 28, padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "center", gap: 28, flexWrap: "wrap", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--muted)" }}>
        <span style={{ display: "inline-flex", gap: 1, color: "oklch(0.85 0.16 85)" }}><I.star /><I.star /><I.star /><I.star /><I.star /></span>
        <span style={{ color: "var(--text)", fontWeight: 500 }}>4.9</span> on Product Hunt
      </div>
      <Sep />
      <div style={{ fontSize: 13.5, color: "var(--muted)" }}><span style={{ color: "var(--text)", fontWeight: 600 }}>62,400+</span> directors creating</div>
      <Sep />
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--muted)" }}>
        <span style={{ color: "var(--accent)", display: "inline-flex" }}><I.check /></span> Free draft, no card needed
      </div>
    </div>
  );
}

function Samples({ go }) {
  const items = ["A 30-second product reveal of a ceramic kettle…", "Onboarding explainer for a budgeting app, 60s", "Top-5 facts about deep-sea creatures, vertical", "Brand teaser, glitch & chrome, 15s", "Recipe reel: brown-butter cookies, overhead"];
  return (
    <div style={{ marginTop: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--dim)", fontFamily: '"Geist Mono", monospace' }}>Try a prompt</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 900 }}>
        {items.map((t, i) => (
          <button key={i} onClick={() => go("/register")} style={{ padding: "8px 14px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--muted)", fontSize: 13, fontFamily: "inherit", cursor: "pointer", transition: "all .15s" }}>
            <span style={{ color: "var(--accent)", marginRight: 6 }}>↳</span>{t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Hero({ go }) {
  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "72px 28px 80px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Badge /><Headline />
      <div style={{ width: "100%", maxWidth: 920 }}><PromptCard go={go} /><Trust /><Samples go={go} /></div>
    </main>
  );
}

/* ============================ SHOWCASE ============================ */
function VideoFrame({ palette, scene, aspect = "16/9" }) {
  const [a, b, c] = palette;
  return (
    <div style={{ position: "relative", aspectRatio: aspect, width: "100%", borderRadius: 12, overflow: "hidden", background: `linear-gradient(135deg, ${a} 0%, ${b} 55%, ${c} 100%)`, boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.08), inset 0 -40px 60px -20px oklch(0 0 0 / 0.4)" }}>
      {scene}
      <div style={{ position: "absolute", top: 10, right: 10, padding: "3px 8px", borderRadius: 6, background: "oklch(0 0 0 / 0.55)", color: "oklch(1 0 0 / 0.95)", fontSize: 11, fontFamily: '"Geist Mono", monospace', fontWeight: 500, backdropFilter: "blur(4px)" }}>0:30</div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 999, background: "oklch(1 0 0 / 0.18)", backdropFilter: "blur(8px)", border: "1px solid oklch(1 0 0 / 0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "oklch(1 0 0 / 0.95)", boxShadow: "0 8px 24px -6px oklch(0 0 0 / 0.5)" }}><I.play /></div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "oklch(0 0 0 / 0.35)" }}>
        <div style={{ height: "100%", width: "38%", background: "var(--accent)" }} />
      </div>
    </div>
  );
}

const SCENES = {
  kettle: (<><div style={{ position: "absolute", left: "30%", bottom: "18%", width: "40%", height: "55%", background: "radial-gradient(ellipse at 35% 30%, oklch(0.35 0.02 60), oklch(0.10 0.01 60))", borderRadius: "30% 30% 8% 8% / 50% 50% 8% 8%" }} /></>),
  app: (<><div style={{ position: "absolute", left: "30%", top: "12%", width: "40%", height: "76%", background: "linear-gradient(160deg, oklch(0.25 0.02 260), oklch(0.15 0.02 260))", borderRadius: 18, border: "1px solid oklch(1 0 0 / 0.1)" }} /><div style={{ position: "absolute", left: "38%", top: "22%", width: "24%", height: "6%", background: "var(--accent)", borderRadius: 4 }} /><div style={{ position: "absolute", left: "38%", top: "42%", width: "24%", height: "30%", background: "oklch(1 0 0 / 0.08)", borderRadius: 8 }} /></>),
  ocean: (<><div style={{ position: "absolute", inset: "30% 10% 10% 10%", background: "radial-gradient(ellipse at 50% 60%, oklch(0.55 0.10 230 / 0.7), transparent 70%)", filter: "blur(6px)" }} /></>),
  glitch: (<><div style={{ position: "absolute", left: "20%", top: "30%", width: "60%", height: "40%", background: "linear-gradient(90deg, transparent, oklch(0.95 0.05 30 / 0.8), transparent)", mixBlendMode: "screen" }} /><div style={{ position: "absolute", left: "15%", top: "42%", width: "70%", height: "3%", background: "oklch(0.95 0.15 200)", opacity: 0.6 }} /></>),
  cookie: (<><div style={{ position: "absolute", left: "20%", top: "22%", width: "60%", height: "60%", background: "radial-gradient(circle at 40% 35%, oklch(0.65 0.10 60), oklch(0.32 0.06 50))", borderRadius: "50%" }} /></>),
  city: (<><div style={{ position: "absolute", left: "10%", bottom: "10%", width: "10%", height: "55%", background: "oklch(0.20 0.02 260)" }} /><div style={{ position: "absolute", left: "22%", bottom: "10%", width: "8%", height: "70%", background: "oklch(0.18 0.02 260)" }} /><div style={{ position: "absolute", left: "46%", bottom: "10%", width: "9%", height: "78%", background: "oklch(0.15 0.02 260)" }} /><div style={{ position: "absolute", left: "55%", top: "20%", width: 60, height: 60, borderRadius: 999, background: "oklch(0.92 0.12 60)", filter: "blur(2px)", opacity: 0.85 }} /></>),
};

function ShowcaseCard({ title, tag, palette, scene, aspect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <VideoFrame palette={palette} scene={scene} aspect={aspect} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 13.5, lineHeight: 1.45, flex: 1 }}><span style={{ color: "var(--accent)" }}>↳</span> {title}</p>
        <span style={{ flexShrink: 0, fontSize: 11, fontFamily: '"Geist Mono", monospace', color: "var(--dim)", padding: "3px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)" }}>{tag}</span>
      </div>
    </div>
  );
}

function Showcase() {
  const items = [
    { title: "Product reveal of a matte-black ceramic kettle, slow dolly-in, warm morning light", tag: "16:9", palette: ["oklch(0.45 0.10 40)", "oklch(0.25 0.05 30)", "oklch(0.15 0.02 40)"], scene: SCENES.kettle, aspect: "16/9" },
    { title: "Onboarding explainer for a budgeting app, 60s", tag: "9:16", palette: ["oklch(0.55 0.18 295)", "oklch(0.30 0.12 290)", "oklch(0.15 0.04 280)"], scene: SCENES.app, aspect: "9/16" },
    { title: "Top-5 facts about deep-sea creatures, animated typography", tag: "9:16", palette: ["oklch(0.40 0.12 230)", "oklch(0.22 0.08 240)", "oklch(0.10 0.03 250)"], scene: SCENES.ocean, aspect: "9/16" },
    { title: "Brand teaser, glitch & chrome, no narration", tag: "1:1", palette: ["oklch(0.30 0.05 280)", "oklch(0.18 0.03 290)", "oklch(0.08 0.01 280)"], scene: SCENES.glitch, aspect: "1/1" },
    { title: "Recipe reel: brown-butter cookies, overhead", tag: "1:1", palette: ["oklch(0.65 0.10 60)", "oklch(0.40 0.08 50)", "oklch(0.20 0.04 40)"], scene: SCENES.cookie, aspect: "1/1" },
    { title: "Real-estate walk-thru, golden hour, ambient score", tag: "16:9", palette: ["oklch(0.65 0.14 50)", "oklch(0.35 0.08 30)", "oklch(0.20 0.04 250)"], scene: SCENES.city, aspect: "16/9" },
  ];
  return (
    <section style={{ position: "relative", padding: "80px 28px 60px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 36 }}>
          <div><Eyebrow num="01">Showcase</Eyebrow><SectionTitle accent="this morning.">Generated</SectionTitle></div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", padding: "8px 12px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent)", animation: "pulse-dot 2s ease-in-out infinite" }} />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>1,284</span> renders in the last hour
          </span>
        </div>
        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(12, 1fr)" }}>
          <div style={{ gridColumn: "span 6" }}><ShowcaseCard {...items[0]} /></div>
          <div style={{ gridColumn: "span 3" }}><ShowcaseCard {...items[1]} /></div>
          <div style={{ gridColumn: "span 3" }}><ShowcaseCard {...items[2]} /></div>
          <div style={{ gridColumn: "span 4" }}><ShowcaseCard {...items[3]} /></div>
          <div style={{ gridColumn: "span 4" }}><ShowcaseCard {...items[4]} /></div>
          <div style={{ gridColumn: "span 4" }}><ShowcaseCard {...items[5]} /></div>
        </div>
      </div>
    </section>
  );
}

/* ============================ MARQUEE ============================ */
function LogoMarquee() {
  const logos = ["NORTHWIND", "Mercury▲", "soft/ware", "POLARIS", "Atlas&Co", "Pangram", "Heliograph", "OBSCURA", "lumen.", "FERRO", "Quarter★", "studio·forge"];
  const all = [...logos, ...logos];
  return (
    <section style={{ position: "relative", padding: "12px 0 60px", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)" }}>
      <div style={{ padding: "30px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 22, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--dim)", fontFamily: '"Geist Mono", monospace' }}>Trusted by teams shipping motion at</div>
        <div style={{ overflow: "hidden" }}>
          <div className="marquee-track" style={{ display: "flex", gap: 56, width: "max-content", color: "var(--faint)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>
            {all.map((l, i) => (<span key={i} style={{ fontFamily: i % 3 === 0 ? '"Instrument Serif", serif' : "inherit", fontStyle: i % 3 === 0 ? "italic" : "normal" }}>{l}</span>))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ HOW IT WORKS ============================ */
function StepVisual({ kind }) {
  const base = { width: "100%", aspectRatio: "5/3", borderRadius: 12, border: "1px solid var(--line-2)", background: "var(--bg-deep)", overflow: "hidden", position: "relative" };
  if (kind === "type") return (
    <div style={base}><div style={{ padding: 18, fontFamily: '"Geist Mono", monospace', fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>A 30-second product reveal of a<br />matte-black ceramic kettle, slow<br />dolly-in, warm morning light<span style={{ display: "inline-block", width: 7, height: 14, background: "var(--accent)", marginLeft: 2, verticalAlign: "middle", animation: "pulse-dot 1.4s steps(2) infinite" }} /></div></div>
  );
  if (kind === "direct") return (
    <div style={{ ...base, padding: 14 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
      {[["oklch(0.45 0.10 40)", "oklch(0.20 0.04 40)"], ["oklch(0.30 0.05 280)", "oklch(0.12 0.02 280)"], ["oklch(0.55 0.08 60)", "oklch(0.25 0.04 60)"], ["oklch(0.35 0.12 230)", "oklch(0.15 0.04 240)"], ["oklch(0.50 0.10 350)", "oklch(0.20 0.04 350)"], ["oklch(0.40 0.08 130)", "oklch(0.18 0.03 130)"]].map(([a, b], i) => (
        <div key={i} style={{ aspectRatio: "16/9", borderRadius: 6, background: `linear-gradient(135deg, ${a}, ${b})`, border: "1px solid oklch(1 0 0 / 0.08)", position: "relative" }}><span style={{ position: "absolute", top: 4, left: 4, fontSize: 9, fontFamily: '"Geist Mono", monospace', color: "oklch(1 0 0 / 0.7)" }}>0{i + 1}</span></div>
      ))}
    </div></div>
  );
  if (kind === "refine") return (
    <div style={{ ...base, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontFamily: '"Geist Mono", monospace', color: "var(--dim)" }}><span>00:00</span><span>00:15</span><span>00:30</span></div>
      {[{ c: "oklch(0.55 0.12 130 / 0.5)", w: "60%", l: 0 }, { c: "oklch(0.55 0.14 280 / 0.5)", w: "85%", l: "8%" }, { c: "oklch(0.55 0.10 200 / 0.5)", w: "40%", l: "30%" }].map((t, i) => (
        <div key={i} style={{ position: "relative", height: 14, background: "oklch(1 0 0 / 0.04)", borderRadius: 4 }}><div style={{ position: "absolute", left: t.l, width: t.w, height: "100%", background: t.c, borderRadius: 4 }} /></div>
      ))}
    </div>
  );
  if (kind === "ship") return (
    <div style={{ ...base, padding: 16, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 10 }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: "var(--accent-15)", border: "1px solid var(--accent-35)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}><I.download style={{ width: 22, height: 22 }} /></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>{["MP4 1080p", "MP4 4K", "ProRes", "WebM", "GIF"].map((f) => (<span key={f} style={{ fontSize: 11, fontFamily: '"Geist Mono", monospace', padding: "3px 8px", borderRadius: 4, background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--muted)" }}>{f}</span>))}</div>
    </div>
  );
  return null;
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Type the scene", body: "Plain language — describe the shot, mood, length, who's narrating. No timelines, no keyframes.", kind: "type" },
    { n: "02", title: "Director drafts it", body: "Six storyboard panels, voiceover, music and SFX appear within ten seconds.", kind: "direct" },
    { n: "03", title: "Refine in timeline", body: "Drag, trim, swap a voice, recolor a scene. Every layer stays editable.", kind: "refine" },
    { n: "04", title: "Ship anywhere", body: "Export to MP4, ProRes, WebM or GIF. Or post straight to social with one tap.", kind: "ship" },
  ];
  return (
    <section style={{ padding: "100px 28px", position: "relative" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Eyebrow num="02">Workflow</Eyebrow><SectionTitle accent="to MP4.">From idea</SectionTitle>
        <p style={{ marginTop: 14, color: "var(--muted)", fontSize: 17, maxWidth: 560, lineHeight: 1.5 }}>Four steps. The first one's the only one that takes thought.</p>
        <div style={{ marginTop: 56, display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ position: "relative", padding: "22px 22px 24px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: '"Geist Mono", monospace', fontSize: 12 }}><span style={{ color: "var(--accent)" }}>{s.n}</span><span style={{ color: "var(--dim)" }}>step {i + 1}/4</span></div>
              <StepVisual kind={s.kind} />
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.015em" }}>{s.title}</h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.5 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ FEATURES ============================ */
function FeatureCard({ children, style }) {
  return (<div style={{ position: "relative", borderRadius: 18, background: "var(--surface)", border: "1px solid var(--line)", padding: 26, overflow: "hidden", display: "flex", flexDirection: "column", ...style }}>{children}</div>);
}
function FeatureLabel({ icon, children }) {
  return (<div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--dim)", fontFamily: '"Geist Mono", monospace' }}><span style={{ color: "var(--accent)", display: "inline-flex" }}>{icon}</span>{children}</div>);
}
function FeatureTitle({ children, accent }) {
  return (<h3 style={{ margin: "14px 0 10px", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{children}{accent && (<span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400 }}>{" "}{accent}</span>)}</h3>);
}
function FeatureBody({ children }) {
  return (<p style={{ margin: 0, color: "var(--muted)", fontSize: 14.5, lineHeight: 1.55, maxWidth: 460 }}>{children}</p>);
}
function MotionStripVisual() {
  return (
    <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
      {Array.from({ length: 8 }).map((_, i) => { const t = i / 7; return (
        <div key={i} style={{ aspectRatio: "3/4", borderRadius: 8, background: `linear-gradient(${135 + t * 60}deg, oklch(${0.45 + t * 0.1} ${0.10 + t * 0.06} ${40 + t * 60}), oklch(${0.20 + t * 0.05} 0.04 ${30 + t * 60}))`, border: "1px solid oklch(1 0 0 / 0.08)", position: "relative" }}>
          <div style={{ position: "absolute", left: `${30 - t * 5}%`, top: `${50 - t * 15}%`, width: 8 + t * 10, height: 8 + t * 10, borderRadius: 999, background: "oklch(1 0 0 / 0.7)" }} />
        </div>); })}
    </div>
  );
}
function VoiceVisual() {
  const voices = [{ name: "Eli", tag: "warm · 32", active: true }, { name: "Sora", tag: "bright · 24" }, { name: "Kit", tag: "deep · 41" }];
  return (
    <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 8 }}>
      {voices.map((v, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: v.active ? "var(--accent-12)" : "var(--surface-2)", border: `1px solid ${v.active ? "var(--accent-35)" : "var(--line)"}` }}>
          <div style={{ width: 28, height: 28, borderRadius: 999, background: v.active ? "var(--accent)" : "oklch(0.35 0.02 260)", color: v.active ? "var(--accent-ink)" : "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{v.name[0]}</div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 2, height: 18 }}>
            {Array.from({ length: 24 }).map((_, j) => (<span key={j} style={{ flex: 1, height: `${20 + (Math.sin(i * 7 + j * 1.3) * 0.5 + 0.5) * 80}%`, background: v.active ? "var(--accent)" : "var(--faint)", opacity: v.active ? 0.85 : 0.45, borderRadius: 1 }} />))}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: '"Geist Mono", monospace', minWidth: 72, textAlign: "right" }}><div style={{ color: v.active ? "var(--accent)" : "var(--text)" }}>{v.name}</div><div style={{ fontSize: 10, color: "var(--dim)", marginTop: 2 }}>{v.tag}</div></div>
        </div>
      ))}
    </div>
  );
}
function ScoreVisual() {
  return (
    <div style={{ marginTop: 22, padding: "16px 14px", borderRadius: 12, background: "var(--bg-deep)", border: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: '"Geist Mono", monospace', color: "var(--dim)", marginBottom: 10 }}><span>Ambient · Cmaj</span><span>72 BPM</span></div>
      <div style={{ display: "flex", gap: 2, alignItems: "center", height: 56 }}>
        {Array.from({ length: 60 }).map((_, i) => { const h = Math.abs(Math.sin(i * 0.4) + Math.cos(i * 0.18)) * 0.5 + 0.2; const beat = i % 8 === 0; return (<span key={i} style={{ flex: 1, height: `${h * 100}%`, background: beat ? "var(--accent)" : "oklch(0.65 0.06 200)", opacity: beat ? 0.95 : 0.55, borderRadius: 1 }} />); })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>{["Ambient", "Cinematic", "Lo-fi", "Driving", "Tense"].map((g, i) => (<span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: i === 0 ? "var(--accent-12)" : "var(--surface-2)", color: i === 0 ? "var(--accent)" : "var(--muted)", border: `1px solid ${i === 0 ? "var(--accent-35)" : "var(--line)"}`, fontFamily: '"Geist Mono", monospace' }}>{g}</span>))}</div>
    </div>
  );
}
function Features() {
  return (
    <section style={{ padding: "60px 28px 100px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Eyebrow num="03">Capabilities</Eyebrow><SectionTitle accent="that doesn't look AI.">Motion</SectionTitle>
        <p style={{ marginTop: 14, color: "var(--muted)", fontSize: 17, maxWidth: 600, lineHeight: 1.5 }}>A full director's toolkit — camera, cast, score, edit — wired into one model.</p>
        <div style={{ marginTop: 56, display: "grid", gap: 20, gridTemplateColumns: "repeat(6, 1fr)" }}>
          <FeatureCard style={{ gridColumn: "span 4" }}><FeatureLabel icon={<I.film />}>Cinematic motion</FeatureLabel><FeatureTitle accent="that breathes.">Camera moves</FeatureTitle><FeatureBody>Dolly, push, parallax, whip-pan — driven by a model trained on shot grammar, not just frames.</FeatureBody><MotionStripVisual /></FeatureCard>
          <FeatureCard style={{ gridColumn: "span 2" }}><FeatureLabel icon={<I.mic />}>Voices</FeatureLabel><FeatureTitle>200+ voices, 40 languages.</FeatureTitle><VoiceVisual /></FeatureCard>
          <FeatureCard style={{ gridColumn: "span 3" }}><FeatureLabel icon={<I.music />}>Adaptive score</FeatureLabel><FeatureTitle accent="to the cut.">Music written</FeatureTitle><FeatureBody>The score stretches, lifts, and resolves around your edits. Royalty-cleared.</FeatureBody><ScoreVisual /></FeatureCard>
          <FeatureCard style={{ gridColumn: "span 3" }}><FeatureLabel icon={<I.palette />}>Brand kits</FeatureLabel><FeatureTitle>Your palette, your type.</FeatureTitle><FeatureBody>Drop a logo. Lock the colors. Every render stays on-brand.</FeatureBody>
            <div style={{ marginTop: 22, display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, flexShrink: 0, background: "var(--bg-deep)", border: "1px solid var(--line-2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22, color: "var(--text)" }}>◆<span style={{ color: "var(--accent)" }}>N</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, flex: 1 }}>{["#0F1116", "#D6F54A", "#F6F4EF", "#E26B4E", "#3FAEC8"].map((c, i) => (<div key={i} style={{ aspectRatio: "1", borderRadius: 8, background: c, border: "1px solid oklch(1 0 0 / 0.08)" }} />))}</div>
            </div>
          </FeatureCard>
          <FeatureCard style={{ gridColumn: "span 2" }}><FeatureLabel icon={<I.team />}>Collaboration</FeatureLabel><FeatureTitle>Direct together.</FeatureTitle><FeatureBody>Live cursors, threaded comments on the timeline, version history.</FeatureBody></FeatureCard>
          <FeatureCard style={{ gridColumn: "span 2" }}><FeatureLabel icon={<I.globe />}>API & SDKs</FeatureLabel><FeatureTitle>Render at scale.</FeatureTitle><FeatureBody>REST + webhooks, batch up to 10k variants. SDKs in TS, Python, Go.</FeatureBody></FeatureCard>
          <FeatureCard style={{ gridColumn: "span 2" }}><FeatureLabel icon={<I.shield />}>Provenance</FeatureLabel><FeatureTitle>C2PA signed.</FeatureTitle><FeatureBody>Every render carries cryptographic content credentials.</FeatureBody></FeatureCard>
        </div>
      </div>
    </section>
  );
}

/* ============================ PRICING ============================ */
function PriceCard({ name, price, period, blurb, features, cta, featured, note, go }) {
  return (
    <div style={{ position: "relative", padding: 28, borderRadius: 20, background: "var(--surface)", border: `1px solid ${featured ? "var(--accent-35)" : "var(--line)"}`, boxShadow: featured ? "0 30px 80px -40px var(--accent-50), 0 0 0 1px var(--accent-15)" : "none", display: "flex", flexDirection: "column", gap: 16 }}>
      {featured && (<span style={{ position: "absolute", top: -10, left: 24, padding: "4px 10px", borderRadius: 999, background: "var(--accent)", color: "var(--accent-ink)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Most popular</span>)}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{name}</h3>{note && <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: '"Geist Mono", monospace' }}>{note}</span>}</div>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.5, minHeight: 42 }}>{blurb}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-0.04em" }}>{price}</span><span style={{ color: "var(--muted)", fontSize: 14 }}>{period}</span></div>
      <button onClick={() => go("/register")} style={{ padding: "12px 16px", borderRadius: 12, fontFamily: "inherit", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer", border: "none", background: featured ? "var(--accent)" : "var(--surface-3)", color: featured ? "var(--accent-ink)" : "var(--text)", boxShadow: featured ? "0 0 0 1px var(--accent-50), 0 14px 36px -12px var(--accent-55)" : "0 0 0 1px var(--line-2)" }}>{cta}</button>
      <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {features.map((f, i) => (<li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--text)" }}><span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}><I.check /></span><span>{f}</span></li>))}
      </ul>
    </div>
  );
}
function Pricing({ go }) {
  return (
    <section style={{ padding: "100px 28px", position: "relative" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Eyebrow num="04">Pricing</Eyebrow><SectionTitle accent="for every cut.">A plan</SectionTitle>
        <div style={{ marginTop: 48, display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <PriceCard go={go} name="Draft" price="Free" period="forever" blurb="For curious directors. Generate watermarked drafts and learn the timeline." cta="Start drafting" features={["3 videos per month, up to 30s", "720p export with watermark", "30 stock voices · 12 looks", "Community templates"]} />
          <PriceCard go={go} featured name="Director" price="$24" period="/ month" note="billed yearly" blurb="For solo creators shipping a video a week. No watermarks, full library." cta="Start free trial" features={["Unlimited videos up to 120s", "4K MP4 + ProRes export", "200+ voices in 40 languages", "Brand kits & custom palettes", "Stem-level audio download"]} />
          <PriceCard go={go} name="Studio" price="$79" period="/ seat / mo" blurb="For teams. Collaboration, API, SSO and the renders to back it up." cta="Talk to sales" features={["Everything in Director", "Up to 10-minute videos", "Live collab + version history", "API & SDK · 10k batch renders", "SSO, audit log, custom DPA"]} />
        </div>
        <p style={{ marginTop: 28, textAlign: "center", color: "var(--dim)", fontSize: 13.5 }}>Every plan ships with C2PA provenance, EU/US residency, and SOC 2 in progress.</p>
      </div>
    </section>
  );
}

/* ============================ FINAL CTA ============================ */
function FinalCTA({ go }) {
  return (
    <section style={{ padding: "60px 28px 100px", position: "relative" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative", overflow: "hidden", borderRadius: 28, background: "var(--surface)", border: "1px solid var(--line-2)", padding: "72px 48px 64px" }}>
        <div aria-hidden style={{ position: "absolute", right: -120, top: -120, width: 460, height: 460, borderRadius: 999, background: "radial-gradient(closest-side, var(--accent-35), transparent 70%)", filter: "blur(20px)", pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", left: -160, bottom: -160, width: 380, height: 380, borderRadius: 999, background: "radial-gradient(closest-side, oklch(0.55 0.18 295 / 0.35), transparent 70%)", filter: "blur(20px)", pointerEvents: "none" }} />
        <div style={{ position: "relative", textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <Eyebrow>Ready when you are</Eyebrow>
          <h2 style={{ margin: 0, fontSize: "clamp(40px, 5.5vw, 68px)", fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.02 }}>Your first video is{" "}<span style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", fontWeight: 400 }}>one prompt away.</span></h2>
          <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 17, lineHeight: 1.5 }}>Free draft, no card. Cancel by hitting Cmd-Z.</p>
          <div style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 16, background: "var(--surface-3)", border: "1px solid var(--line-2)" }}>
            <span style={{ paddingLeft: 12, color: "var(--dim)", fontFamily: '"Geist Mono", monospace', fontSize: 13 }}>↳</span>
            <input type="text" defaultValue="A 15-second teaser for my coffee bag, dark roast" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 16, fontFamily: "inherit", padding: "12px 4px", caretColor: "var(--accent)" }} />
            <button onClick={() => go("/register")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 12, background: "var(--accent)", color: "var(--accent-ink)", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", boxShadow: "0 0 0 1px var(--accent-50), 0 14px 36px -12px var(--accent-55)" }}>Direct it <I.arrow /></button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ FOOTER ============================ */
function Footer() {
  const cols = [
    { h: "Product", links: ["Discover", "Director", "Motion", "Scenes", "Voices", "Pricing"] },
    { h: "Resources", links: ["Docs", "API reference", "Changelog", "Status", "Roadmap"] },
    { h: "Company", links: ["About", "Customers", "Careers", "Affiliates", "Contact"] },
    { h: "Legal", links: ["Terms", "Privacy", "DPA", "Provenance", "Cookies"] },
  ];
  return (
    <footer style={{ borderTop: "1px solid var(--line)", padding: "72px 28px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gap: 48, gridTemplateColumns: "1.4fr repeat(4, 1fr)", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Mark size={32} /><Wordmark size={19} /></div>
            <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 14, lineHeight: 1.6, maxWidth: 320 }}>Direct cinematic video from a single prompt. Built for everyone who has a story and not enough hours.</p>
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
        <div style={{ marginTop: 40, fontSize: "clamp(80px, 18vw, 240px)", fontWeight: 700, letterSpacing: "-0.06em", lineHeight: 0.9, color: "transparent", WebkitTextStroke: "1px var(--line-2)", textAlign: "center", userSelect: "none", fontFamily: '"Instrument Serif", serif', fontStyle: "italic" }}>re·motion</div>
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
      <Showcase />
      <LogoMarquee />
      <HowItWorks />
      <Features />
      <Pricing go={go} />
      <FinalCTA go={go} />
      <Footer />
    </div>
  );
}
