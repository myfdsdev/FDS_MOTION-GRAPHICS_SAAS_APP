import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Share the Remotion composition source with the backend renderer so
      // @remotion/player previews the exact same component tree that gets
      // baked into the final MP4 — no double-implementation.
      "@remotion-comp": path.resolve(__dirname, "../backend/remotion"),
    },
    // The composition file lives under ../backend, so a naïve resolve would
    // pull `remotion` from backend/node_modules — a SECOND copy of the lib.
    // Two copies = two React contexts = `useVideoConfig` returns null and
    // the Player crashes with "No video config found". Dedupe forces every
    // Remotion import (no matter where the file lives) to resolve to the
    // client's node_modules, so the Player and the composition share state.
    dedupe: [
      "react",
      "react-dom",
      "remotion",
      "@remotion/player",
      "@remotion/lottie",
    ],
  },
  // Vite pre-bundles deps; force it to scan the backend composition's deps
  // so its `remotion` import is rewritten to the deduped copy in dev.
  optimizeDeps: {
    include: ["remotion", "@remotion/player", "@remotion/lottie"],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL,
        changeOrigin: true,
      },
    },
  },
});
