import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { deckApiPlugin } from "./src/server/deckApi";

export default defineConfig(({ command }) => ({
  // For GitHub Pages: set VITE_BASE_PATH env var (e.g., "/deckode/")
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [
    react(),
    tailwindcss(),
    // Only load the Vite dev server API plugin during dev
    ...(command === "serve" ? [deckApiPlugin()] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    watch: {
      ignored: [
        path.resolve(__dirname, "projects/**"),
      ],
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
}));
