import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import type { Plugin, ProxyOptions } from "vite";
import { type RawData, WebSocketServer } from "ws";

// An API that requires a token refuses browser origins, so the browser cannot call it directly.
// The dev server then acts as the API client: it adds the token to proxied requests and bridges
// the terminal WebSocket, which the Vite proxy cannot carry (ADR 0007). The token never reaches
// the browser.

const API_PATHS = ["/v1", "/healthz"];
const TERMINAL_PATH = "/v1/terminal";

const isApiPath = (url: string | undefined) =>
  API_PATHS.some((path) => url === path || url?.startsWith(`${path}/`) || url?.startsWith(`${path}?`));

// The dev server holds the token, so a page from another site must not be able to use it.
const isSameOrigin = (request: IncomingMessage) => {
  const origin = request.headers.origin;
  return !origin || origin === `http://${request.headers.host}`;
};

export const createApiProxy = (target: string, token: string): Record<string, ProxyOptions> => {
  const proxy: ProxyOptions = {
    target,
    headers: { authorization: `Bearer ${token}` },
    configure: (server) => {
      server.on("proxyReq", (proxyRequest) => proxyRequest.removeHeader("origin"));
    },
  };
  return Object.fromEntries(API_PATHS.map((path) => [path, proxy]));
};

const terminalUpstreamUrl = (target: string, requestUrl: string) => {
  const url = new URL(requestUrl, target);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

// Codes 1004-1006 and 1015 describe a lost connection and may not be sent in a close frame.
const sendableCloseCode = (code: number) =>
  code >= 1000 && code <= 4999 && ![1004, 1005, 1006, 1015].includes(code) ? code : 1000;

type UpstreamSocket = WebSocket;
type UpstreamSocketConstructor = new (url: string, init: { headers: Record<string, string> }) => UpstreamSocket;

export const bridgeTerminalWebSockets = (httpServer: Server, target: string, token: string) => {
  const sockets = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (request.url?.split("?", 1)[0] !== TERMINAL_PATH) return;
    if (!isSameOrigin(request)) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }

    sockets.handleUpgrade(request, socket, head, (client) => {
      // Bun and Node both accept headers in the WebSocket constructor; the DOM type does not.
      const Upstream = WebSocket as unknown as UpstreamSocketConstructor;
      const upstream = new Upstream(terminalUpstreamUrl(target, request.url ?? TERMINAL_PATH), {
        headers: { authorization: `Bearer ${token}` },
      });
      const pending: string[] = [];
      const forward = (data: RawData) => {
        const message = data.toString();
        if (upstream.readyState === WebSocket.OPEN) upstream.send(message);
        else pending.push(message);
      };

      upstream.addEventListener("open", () => {
        for (const message of pending.splice(0)) upstream.send(message);
      });
      upstream.addEventListener("message", (event) => client.send(String(event.data)));
      upstream.addEventListener("close", (event) => client.close(sendableCloseCode(event.code), event.reason));
      upstream.addEventListener("error", () => client.close(1011, "Terminal upstream failed"));
      client.on("message", forward);
      client.on("close", () => upstream.close());
    });
  });
};

export const createApiCredentialPlugin = (input: { target: string; token: string }): Plugin => ({
  name: "pstdio-dashboard-api-credential",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (!isApiPath(request.url) || isSameOrigin(request)) {
        next();
        return;
      }
      response.statusCode = 403;
      response.end("Forbidden");
    });
    if (server.httpServer) bridgeTerminalWebSockets(server.httpServer as Server, input.target, input.token);
  },
});
