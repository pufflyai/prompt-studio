import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { externalizeDeps } from "vite-plugin-externalize-deps";
import svgr from "vite-plugin-svgr";
import { entries } from "./build-entries";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    lib: {
      entry: entries,
      formats: ["es"],
      cssFileName: "style",
    },
    rollupOptions: {
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    svgr(),
    // The prebuilt Monaco files stay separate, so apps copy them instead of bundling Monaco again.
    externalizeDeps({ include: [/^@pstdio\/ui\/monaco\//] }),
  ],
});
