import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Build optimizations for production
  build: {
    // Use Rollup's code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          "vendor-react": ["react", "react-dom"],
          // Mantine UI framework
          "vendor-mantine": [
            "@mantine/core",
            "@mantine/hooks",
            "@mantine/notifications",
          ],
          // Monaco editor (large bundle)
          "vendor-monaco": ["monaco-editor", "@monaco-editor/react"],
          // PDF libraries
          "vendor-pdf": ["react-pdf", "pdfjs-dist"],
          // Graph visualization
          "vendor-graph": ["react-force-graph-2d"],
          // Utilities
          "vendor-utils": ["lodash", "zustand"],
        },
      },
    },
    // Target modern browsers for smaller output
    target: "esnext",
    // Increase chunk size warning limit (Monaco is large)
    chunkSizeWarningLimit: 1500,
  },

  // Pre-bundle dependencies for faster dev server startup
  optimizeDeps: {
    include: ["react", "react-dom", "lodash", "zustand", "@mantine/core"],
  },
}));
