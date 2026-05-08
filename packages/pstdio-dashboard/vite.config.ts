import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiProxyTarget = process.env.PSTDIO_API_URL ?? "http://localhost:19841";

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      "/v1": apiProxyTarget,
      "/healthz": apiProxyTarget,
    },
  },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@chakra-ui/react",
      "@emotion/react",
      "@emotion/styled",
    ],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      $fonts: path.resolve(__dirname, "public/font"),
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
});
