import { describe, expect, it } from "bun:test";

import { createServeApp } from "./serve-app";

describe("serveApp", () => {
  it("closes the app when server startup throws", async () => {
    let closed = false;

    const serveApp = createServeApp({
      createApp: async () => ({
        app: {
          fetch: () => new Response("ok"),
        },
        close: async () => {
          closed = true;
        },
      }),
      injectConfig: (html) => html,
      isCompiledBinary: () => false,
      loadEmbeddedAssets: () => new Map(),
      loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      resolveMimeType: () => "text/html",
      serve: () => {
        throw new Error("listen EADDRINUSE");
      },
      reportStartupError: () => {},
    });

    await expect(serveApp({ port: 19840 })).rejects.toThrow("EADDRINUSE");
    expect(closed).toBe(true);
  });

  it("reports the error through startup logging when server startup throws", async () => {
    let reportedError: Error | undefined;

    const serveApp = createServeApp({
      createApp: async () => ({
        app: {
          fetch: () => new Response("ok"),
        },
        close: async () => {},
      }),
      injectConfig: (html) => html,
      isCompiledBinary: () => false,
      loadEmbeddedAssets: () => new Map(),
      loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      resolveMimeType: () => "text/html",
      serve: () => {
        throw new Error("listen EADDRINUSE");
      },
      reportStartupError: (error) => {
        reportedError = error;
      },
    });

    await expect(serveApp({ port: 19840 })).rejects.toThrow("EADDRINUSE");
    expect(reportedError).toBeDefined();
    expect(reportedError!.message).toBe("listen EADDRINUSE");
  });

  it("configures Bun idle timeout to 20 seconds", async () => {
    const captured = { idleTimeout: undefined as number | undefined };

    const serveApp = createServeApp({
      createApp: async () => ({
        app: {
          fetch: () => new Response("ok"),
        },
        close: async () => {},
      }),
      injectConfig: (html) => html,
      isCompiledBinary: () => false,
      loadEmbeddedAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      resolveMimeType: () => "text/html",
      serve: (options) => {
        captured.idleTimeout = options.idleTimeout;
        return {} as ReturnType<typeof Bun.serve>;
      },
      onSignal: () => {},
      offSignal: () => {},
      log: () => {},
    });

    await serveApp({ port: 19840 });

    expect(captured.idleTimeout).toBe(20);
  });
});
