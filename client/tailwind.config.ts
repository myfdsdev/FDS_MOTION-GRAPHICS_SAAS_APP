import type { Config } from "tailwindcss";

const ch = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: ch("--c-bg"),
        "bg-deep": ch("--c-bg-deep"),
        surface: ch("--c-surface"),
        "surface-2": ch("--c-surface-2"),
        "surface-3": ch("--c-surface-3"),
        border: ch("--c-border"),
        "border-soft": ch("--c-border-soft"),
        fg: ch("--c-fg"),
        muted: ch("--c-muted"),
        faint: ch("--c-faint"),
        accent: {
          DEFAULT: ch("--c-accent"),
          hover: ch("--c-accent-hover"),
          soft: ch("--c-accent-soft"),
          ink: ch("--c-accent-ink"),
        },
        star: ch("--c-star"),
        success: ch("--c-success"),
        danger: ch("--c-danger"),
        warning: ch("--c-warning"),
      },
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"Instrument Serif"', "ui-serif", "Georgia", "serif"],
        mono: ['"Geist Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        accent: "0 6px 22px -4px rgb(var(--c-accent) / 0.4)",
        card: "0 24px 48px -20px rgba(0, 0, 0, 0.5)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
