import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// In dev the browser talks to Vite, which proxies /api to the FastAPI server.
// That keeps requests same-origin (no CORS) whatever port Vite ends up on.
const API_TARGET = process.env.VITE_PROXY_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    css: false,
  },
});
