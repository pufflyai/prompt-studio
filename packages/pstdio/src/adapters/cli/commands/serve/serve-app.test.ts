import { describe, expect, it } from "bun:test";
import packageData from "../../../../../package.json";

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

    await expect(serveApp({ port: 19840, host: "localhost" })).rejects.toThrow("EADDRINUSE");
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

    await expect(serveApp({ port: 19840, host: "localhost" })).rejects.toThrow("EADDRINUSE");
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

    await serveApp({ port: 19840, host: "localhost" });

    expect(captured.idleTimeout).toBe(20);
  });

  it("forwards the host option to Bun.serve as hostname", async () => {
    const captured = { hostname: undefined as string | undefined };

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
        captured.hostname = options.hostname;
        return {} as ReturnType<typeof Bun.serve>;
      },
      onSignal: () => {},
      offSignal: () => {},
      log: () => {},
    });

    await serveApp({ port: 19840, host: "0.0.0.0" });

    expect(captured.hostname).toBe("0.0.0.0");
  });

  it("does not inject an absolute apiBaseUrl into the dashboard config", async () => {
    let capturedFetch: NonNullable<Parameters<typeof Bun.serve>[0]["fetch"]> | undefined;
    let injectedApiBaseUrl: string | undefined;

    const serveApp = createServeApp({
      createApp: async () => ({
        app: {
          fetch: () => new Response("ok"),
        },
        close: async () => {},
      }),
      injectConfig: (_html, config) => {
        injectedApiBaseUrl = config.apiBaseUrl;
        return "<html></html>";
      },
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

    await serveApp({ port: 19840, host: "0.0.0.0" });
    await capturedFetch?.call(
      {} as Bun.Server<undefined>,
      new Request("http://192.168.1.5:19840/"),
      {} as Bun.Server<undefined>,
    );

    expect(injectedApiBaseUrl).toBeUndefined();
  });

  it("injects the package version into the served dashboard config", async () => {
    let capturedFetch: NonNullable<Parameters<typeof Bun.serve>[0]["fetch"]> | undefined;
    let injectedVersion: string | undefined;
    const previousVersion = process.env.PSTDIO_VERSION;
    process.env.PSTDIO_VERSION = "9.8.7";

    try {
      const serveApp = createServeApp({
        createApp: async () => ({
          app: {
            fetch: () => new Response("ok"),
          },
          close: async () => {},
        }),
        injectConfig: (_html, config) => {
          injectedVersion = config.version;
          return "<html></html>";
        },
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
      await capturedFetch?.call(
        {} as Bun.Server<undefined>,
        new Request("http://localhost:19840/"),
        {} as Bun.Server<undefined>,
      );
    } finally {
      if (previousVersion === undefined) {
        delete process.env.PSTDIO_VERSION;
      } else {
        process.env.PSTDIO_VERSION = previousVersion;
      }
    }

    expect(injectedVersion).toBe(packageData.version);
  });
});
