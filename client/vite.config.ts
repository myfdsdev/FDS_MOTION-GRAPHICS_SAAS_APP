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
