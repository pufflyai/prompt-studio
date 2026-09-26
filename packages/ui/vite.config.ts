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
