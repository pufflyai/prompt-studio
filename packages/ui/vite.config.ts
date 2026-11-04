import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { entries, isExternal } from "./build-entries.ts";

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
    rolldownOptions: {
      external: isExternal,
      preserveEntrySignatures: "allow-extension",
      output: {
        codeSplitting: {
          groups: [
            {
              // Shared prompt/message helpers must not pull the editor component into eager chunks.
              name: "markdown-editor",
              test: /[\\/]rich-text[\\/]markdown-editor[\\/]markdown-editor\.tsx$/,
              includeDependenciesRecursively: false,
            },
          ],
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
  ],
});
