import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

export type DashboardRuntimeConfig = {
  terminalWebSocketUrl: string;
};

const parseExplicitTerminalUrl = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("PSTDIO_TERMINAL_WEBSOCKET_URL must use ws:// or wss://");
  }
  if (url.username || url.password) {
    throw new Error("PSTDIO_TERMINAL_WEBSOCKET_URL must not contain credentials");
  }
  if (url.hash) {
    throw new Error("PSTDIO_TERMINAL_WEBSOCKET_URL must not contain a fragment");
  }
  return url.toString();
};

const deriveTerminalUrl = (apiProxyTarget: string) => {
  const url = new URL(apiProxyTarget);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("PSTDIO_API_URL must use http:// or https://");
  }
  url.username = "";
  url.password = "";
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/v1/terminal";
  url.search = "";
  url.hash = "";
  return url.toString();
};

export const resolveTerminalWebSocketUrl = (input: { apiProxyTarget: string; terminalWebSocketUrl?: string }) =>
  input.terminalWebSocketUrl
    ? parseExplicitTerminalUrl(input.terminalWebSocketUrl)
    : deriveTerminalUrl(input.apiProxyTarget);

export const injectDashboardRuntimeConfig = (html: string, config: DashboardRuntimeConfig) => {
  const metadata = `<meta name="pstdio-config" content="${encodeURIComponent(JSON.stringify(config))}">`;
  return html.replace("</head>", `${metadata}</head>`);
};

export const createDashboardRuntimeConfigPlugin = (config: DashboardRuntimeConfig): Plugin => ({
  name: "pstdio-dashboard-runtime-config",
  apply: "serve",
  transformIndexHtml(html) {
    return injectDashboardRuntimeConfig(html, config);
  },
  configurePreviewServer(server) {
    return () => {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split("?", 1)[0] !== "/index.html") {
          next();
          return;
        }

        try {
          const indexPath = path.resolve(server.config.root, server.config.build.outDir, "index.html");
          const html = await readFile(indexPath, "utf8");
          response.setHeader("content-type", "text/html");
          response.end(injectDashboardRuntimeConfig(html, config));
        } catch (error) {
          next(error);
        }
      });
    };
  },
});
