import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createApiCredentialPlugin, createApiProxy } from "./vite-api-credential.ts";
import { createDashboardRuntimeConfigPlugin, resolveTerminalWebSocketUrl } from "./vite-runtime-config.ts";

const apiProxyTarget = process.env.PSTDIO_API_URL ?? "http://localhost:19841";
// An API with a token is reached only through this server, terminal included (vite-api-credential.ts).
const apiToken = process.env.PSTDIO_API_TOKEN;
const terminalWebSocketUrl = apiToken
  ? undefined
  : resolveTerminalWebSocketUrl({
      apiProxyTarget,
      terminalWebSocketUrl: process.env.PSTDIO_TERMINAL_WEBSOCKET_URL,
    });
const apiProxy = apiToken
  ? createApiProxy(apiProxyTarget, apiToken)
  : {
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
      "@": path.resolve(import.meta.dirname, "./src"),
      $fonts: path.resolve(import.meta.dirname, "public/font"),
    },
  },
  plugins: [
    createDashboardRuntimeConfigPlugin({ terminalWebSocketUrl }),
    ...(apiToken ? [createApiCredentialPlugin({ target: apiProxyTarget, token: apiToken })] : []),
    react({
      // Workspace dist entries have already passed through the React compiler.
      exclude: ["**/node_modules/**", "**/dist/**"],
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
});
