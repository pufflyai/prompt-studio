import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Bundles src/index.html → dist/lab-page.html so the extension manifest's
// `packageAsset("./dist/lab-page.html", import.meta.url)` resolves to a real file.
export default defineConfig({
  root: path.resolve(__dirname, "src"),
  base: "./",
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    assetsDir: ".",
    rollupOptions: {
      input: path.resolve(__dirname, "src/lab-page.html"),
      output: {
        entryFileNames: "lab-page.js",
        chunkFileNames: "lab-page-[hash].js",
        assetFileNames: "lab-page-[hash][extname]",
      },
    },
  },
});
