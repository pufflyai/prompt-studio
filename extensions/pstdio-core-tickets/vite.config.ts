import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Bundles src/tickets-list-page.html and src/ticket-page.html into dist/ so
// the extension manifest's `packageAsset(...)` paths resolve to real files.
export default defineConfig({
  root: path.resolve(__dirname, "src"),
  base: "./",
  resolve: {
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
      input: {
        "tickets-list-page": path.resolve(__dirname, "src/tickets-list-page.html"),
        "ticket-page": path.resolve(__dirname, "src/ticket-page.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash][extname]",
      },
    },
  },
});
