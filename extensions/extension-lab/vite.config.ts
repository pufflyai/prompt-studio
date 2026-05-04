import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Bundles src/index.html → dist/lab-page.html so the extension manifest's
// `packageAsset("./dist/lab-page.html", import.meta.url)` resolves to a real file.
const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  root: path.resolve(__dirname, "src"),
  base: "./",
  resolve: {
    alias: [
      {
        find: "@pstdio/ui/style.css",
        replacement: path.resolve(repoRoot, "packages/ui/dist/style.css"),
      },
      {
        find: /^@pstdio\/ui$/,
        replacement: path.resolve(repoRoot, "packages/ui/dist/index.js"),
      },
      {
        find: /^@chakra-ui\/react$/,
        replacement: path.resolve(repoRoot, "packages/ui/node_modules/@chakra-ui/react/dist/esm/index.js"),
      },
      {
        find: /^@chakra-ui\/react\/anatomy$/,
        replacement: path.resolve(repoRoot, "packages/ui/node_modules/@chakra-ui/react/dist/esm/anatomy.js"),
      },
      {
        find: /^@chakra-ui\/react\/theme$/,
        replacement: path.resolve(repoRoot, "packages/ui/node_modules/@chakra-ui/react/dist/esm/theme/index.js"),
      },
      {
        find: /^@emotion\/react$/,
        replacement: path.resolve(repoRoot, "packages/ui/node_modules/@emotion/react"),
      },
    ],
    dedupe: [
      "react",
      "react-dom",
      "react/compiler-runtime",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@chakra-ui/react",
      "@emotion/react",
      "@emotion/styled",
    ],
  },
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
