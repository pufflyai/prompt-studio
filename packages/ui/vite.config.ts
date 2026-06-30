import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { externalizeDeps } from "vite-plugin-externalize-deps";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    lib: {
      entry: {
        index: path.resolve(import.meta.dirname, "src/index.ts"),
        "rich-text": path.resolve(import.meta.dirname, "src/components/rich-text/index.ts"),
        theme: path.resolve(import.meta.dirname, "src/theme/index.ts"),
        "chat-ui": path.resolve(import.meta.dirname, "src/components/chat-ui/index.ts"),
        diff: path.resolve(import.meta.dirname, "src/components/diff-viewer/index.ts"),
        "data-renderer": path.resolve(import.meta.dirname, "src/components/data-renderer/index.ts"),
        mermaid: path.resolve(import.meta.dirname, "src/components/mermaid-renderer/index.ts"),
        terminal: path.resolve(import.meta.dirname, "src/components/terminal/index.ts"),
      },
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
    dts({
      tsconfigPath: "./tsconfig.json",
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.stories.tsx"],
      afterDiagnostic: () => {},
    }),
    svgr(),
    externalizeDeps(),
  ],
});
