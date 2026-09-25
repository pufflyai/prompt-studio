import path from "node:path";
import { defineConfig } from "vite";

// Builds Monaco and its workers once. Nx caches the output until `monaco-editor` changes.
// This is an app build, not a library build, because library builds do not minify whitespace,
// and a smaller file is faster for every consuming app to bundle.
export default defineConfig({
  // Relative worker URLs let consuming apps copy the worker files as plain assets.
  base: "./",
  publicDir: false,
  build: {
    outDir: "dist-monaco",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, "src/components/diff-viewer/monaco-bundle.ts"),
      preserveEntrySignatures: "exports-only",
      output: {
        entryFileNames: "monaco.js",
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith(".css")) ? "monaco.css" : "assets/[name]-[hash][extname]",
        inlineDynamicImports: true,
      },
    },
  },
});
