import { describe, expect, it } from "bun:test";
import { apiWebSocket } from "pstdio-api/app";

import { createServeApp } from "./serve-app";

describe("serveApp WebSocket transport", () => {
  it("configures WebSocket upgrades and forwards the Bun server to Hono", async () => {
    let capturedFetch: NonNullable<Parameters<typeof Bun.serve>[0]["fetch"]> | undefined;
    let capturedWebSocket: unknown;
    let forwardedServer: object | undefined;

    const serveApp = createServeApp({
      createApp: async () => ({
        app: {
          fetch: (_request, server) => {
            forwardedServer = server;
            return new Response("ok");
          },
        },
        close: async () => {},
      }),
      injectConfig: (html) => html,
      isCompiledBinary: () => false,
      loadEmbeddedAssets: () => new Map(),
      loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      resolveMimeType: () => "text/html",
      serve: (options) => {
        capturedFetch = options.fetch;
        capturedWebSocket = options.websocket;
        return {} as ReturnType<typeof Bun.serve>;
      },
      onSignal: () => {},
      offSignal: () => {},
      log: () => {},
    });

    await serveApp({ port: 19840, host: "localhost" });
    const server = {} as Bun.Server<undefined>;
    await capturedFetch?.call(server, new Request("http://localhost:19840/v1/terminal"), server);

    expect(capturedWebSocket).toBe(apiWebSocket);
    expect(forwardedServer).toBe(server);
  });

  it("disables the request timeout for extension installs and upgrades", async () => {
    let capturedFetch: NonNullable<Parameters<typeof Bun.serve>[0]["fetch"]> | undefined;
    const timeoutCalls: Array<{ request: Request; seconds: number }> = [];
    const serveApp = createServeApp({
      createApp: async () => ({
        app: { fetch: () => new Response("ok") },
        close: async () => {},
      }),
      injectConfig: (html) => html,
      isCompiledBinary: () => false,
      loadEmbeddedAssets: () => new Map(),
      loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      resolveMimeType: () => "text/html",
      serve: (options) => {
        capturedFetch = options.fetch;
        return {} as ReturnType<typeof Bun.serve>;
      },
      onSignal: () => {},
      offSignal: () => {},
      log: () => {},
    });

    await serveApp({ port: 19840, host: "localhost" });
    const server = {
      timeout: (request: Request, seconds: number) => {
        timeoutCalls.push({ request, seconds });
      },
    } as unknown as Bun.Server<undefined>;
    const paths = ["/v1/projects/project-1/extensions/instance-1/upgrade", "/v1/projects/project-1/extensions/install"];

    for (const path of paths) {
      const request = new Request(`http://localhost:19840${path}`, { method: "POST" });
      await capturedFetch?.call(server, request, server);
    }

    expect(timeoutCalls.map(({ seconds }) => seconds)).toEqual([0, 0]);
  });
});

describe("serveApp performance diagnostics", () => {
  it("forwards probes and their authorization to the API instead of dashboard assets", async () => {
    const app = {
      fetch: (request: Request) =>
        request.headers.get("authorization") === "Bearer runtime-secret"
          ? Response.json({ pid: process.pid, counters: { activeSessions: 0 } })
          : Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
    let server!: ReturnType<typeof Bun.serve>;
    const serveApp = createServeApp({
      createApp: async () => ({ app, close: async () => {} }),
      injectConfig: (html) => html,
      isCompiledBinary: () => false,
      loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html>dashboard</html>"])]]),
      serve: (options) => {
        server = Bun.serve(options);
        return server;
      },
      log: () => {},
      onSignal: () => {},
      offSignal: () => {},
      onFatal: () => {},
      offFatal: () => {},
    });
    await serveApp({ port: 0, host: "127.0.0.1" });
    try {
      const url = `http://127.0.0.1:${server.port}/diagnostics/performance`;
      const denied = await fetch(url);
      expect(denied.status).toBe(401);
      const response = await fetch(url, { headers: { authorization: "Bearer runtime-secret" } });
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ pid: process.pid });
    } finally {
      await server.stop(true);
    }
  });
});
