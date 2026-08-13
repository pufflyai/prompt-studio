import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createDashboardRuntimeConfigPlugin, resolveTerminalWebSocketUrl } from "./vite-runtime-config";

const apiProxyTarget = process.env.PSTDIO_API_URL ?? "http://localhost:19841";
const terminalWebSocketUrl = resolveTerminalWebSocketUrl({
  apiProxyTarget,
  terminalWebSocketUrl: process.env.PSTDIO_TERMINAL_WEBSOCKET_URL,
});
const apiProxy = {
  "/v1": apiProxyTarget,
  "/healthz": apiProxyTarget,
};

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
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
    createDashboardRuntimeConfigPlugin({ terminalWebSocketUrl }),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
});
