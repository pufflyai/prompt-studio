import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apiWebSocket } from "pstdio-api/app";
import type { RuntimeHost } from "pstdio-api/runtime";
import packageData from "../../../../../package.json";

import { createServeApp } from "./serve-app";

describe("serveApp startup ordering", () => {
  it("binds and publishes before app initialization finishes", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-serve-early-bind-"));
    const descriptorPath = join(root, "runtime.json");
    const appReady = Promise.withResolvers<{
      app: { fetch: (request: Request) => Response };
      close: () => Promise<void>;
    }>();
    let capturedFetch: NonNullable<Parameters<typeof Bun.serve>[0]["fetch"]> | undefined;
    const serveApp = createServeApp({
      createApp: (_host, onDatabaseLockAcquired) => {
        onDatabaseLockAcquired?.();
        return appReady.promise;
      },
      injectConfig: (html) => html,
      isCompiledBinary: () => false,
      loadEmbeddedAssets: () => new Map(),
      loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      resolveMimeType: () => "text/html",
      serve: (options) => {
        capturedFetch = options.fetch;
        return { port: 43128, stop: () => {} } as ReturnType<typeof Bun.serve>;
      },
      onSignal: () => {},
      offSignal: () => {},
      onFatal: () => {},
      offFatal: () => {},
      log: () => {},
    });
    const starting = serveApp({
      descriptorPath,
      host: "127.0.0.1",
      instanceId: "runtime-early-bind",
      ownerType: "desktop",
      port: 0,
      token: "runtime-secret",
    });

    try {
      await Promise.resolve();
      expect(existsSync(descriptorPath)).toBe(true);

      const server = {} as Bun.Server<undefined>;
      const response = capturedFetch!.call(server, new Request("http://127.0.0.1:43128/v1/projects"), server);
      let requestSettled = false;
      void Promise.resolve(response).then(() => {
        requestSettled = true;
      });
      await Promise.resolve();
      expect(requestSettled).toBe(false);

      appReady.resolve({
        app: {
          fetch: (request) =>
            new URL(request.url).pathname === "/runtime/ready"
              ? Response.json({ instanceId: "runtime-early-bind", protocolVersion: 1 })
              : new Response("app-ready"),
        },
        close: async () => {},
      });

      const resolvedResponse = await response;
      if (!(resolvedResponse instanceof Response)) throw new Error("Expected the queued API response");
      expect(await resolvedResponse.text()).toBe("app-ready");
      await starting;
    } finally {
      appReady.resolve({ app: { fetch: () => new Response("app-ready") }, close: async () => {} });
      await starting.catch(() => {});
      rmSync(root, { force: true, recursive: true });
    }
  });
});

describe("serveApp", () => {
  it("publishes the actual port-zero origin and promotes ownership through the runtime host", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-serve-runtime-"));
    const descriptorPath = join(root, "runtime.json");
    const logs: string[] = [];
    let runtimeHost: RuntimeHost | undefined;

    try {
      const serveApp = createServeApp({
        createApp: async (host, onDatabaseLockAcquired) => {
          runtimeHost = host;
          onDatabaseLockAcquired?.();
          return {
            app: {
              fetch: () =>
                new Response(
                  JSON.stringify({
                    instanceId: host!.instanceId,
                    ok: true,
                    ownerType: host!.ownerType(),
                    protocolVersion: 1,
                  }),
                ),
            },
            close: async () => {},
          };
        },
        injectConfig: (html) => html,
        isCompiledBinary: () => false,
        loadEmbeddedAssets: () => new Map(),
        loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
        resolveMimeType: () => "text/html",
        serve: () => ({ port: 43127, stop: () => {} }) as ReturnType<typeof Bun.serve>,
        onSignal: () => {},
        offSignal: () => {},
        onFatal: () => {},
        offFatal: () => {},
        log: (message) => logs.push(message),
      });

      await serveApp({
        descriptorPath,
        host: "127.0.0.1",
        instanceId: "runtime-one",
        ownerType: "desktop",
        port: 0,
        token: "runtime-secret",
      });

      expect(JSON.parse(readFileSync(descriptorPath, "utf8"))).toMatchObject({
        instanceId: "runtime-one",
        origin: "http://127.0.0.1:43127",
        ownerType: "desktop",
        pid: process.pid,
        token: "runtime-secret",
      });
      expect(logs.join("")).toContain('"origin":"http://127.0.0.1:43127"');
      expect(logs.join("")).not.toContain("runtime-secret");

      await runtimeHost!.promote();
      expect(JSON.parse(readFileSync(descriptorPath, "utf8")).ownerType).toBe("persistent");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});

describe("serveApp shutdown", () => {
  it("does not let server connections block runtime resource cleanup", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-serve-shutdown-"));
    const descriptorPath = join(root, "runtime.json");
    let runtimeHost: RuntimeHost | undefined;
    let exitCode: number | undefined;

    try {
      const serveApp = createServeApp({
        createApp: async (host, onDatabaseLockAcquired) => {
          runtimeHost = host;
          onDatabaseLockAcquired?.();
          return {
            app: { fetch: () => new Response("ok") },
            close: async () => {},
          };
        },
        injectConfig: (html) => html,
        isCompiledBinary: () => false,
        loadEmbeddedAssets: () => new Map(),
        loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
        resolveMimeType: () => "text/html",
        serve: () =>
          ({
            port: 43129,
            stop: (closeActiveConnections?: boolean) => {
              if (!closeActiveConnections) throw new Error("active connection is still open");
              return new Promise<void>(() => {});
            },
          }) as ReturnType<typeof Bun.serve>,
        onSignal: () => {},
        offSignal: () => {},
        onFatal: () => {},
        offFatal: () => {},
        exit: (code = 0) => {
          exitCode = code;
          return undefined as never;
        },
        log: () => {},
      });

      await serveApp({
        descriptorPath,
        host: "127.0.0.1",
        instanceId: "runtime-shutdown",
        ownerType: "persistent",
        port: 0,
        token: "runtime-secret",
      });

      const shutdownResult = await Promise.race([
        runtimeHost!.shutdown().then(() => "closed" as const),
        Bun.sleep(100).then(() => "blocked" as const),
      ]);

      expect(shutdownResult).toBe("closed");
      expect(exitCode).toBe(0);
      expect(existsSync(descriptorPath)).toBe(false);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});

describe("serveApp options", () => {
  it("leaves state path defaults to the app runtime", async () => {
    const previousDbPath = process.env.PSTDIO_DB_PATH;
    const previousStoragePath = process.env.PSTDIO_STORAGE_PATH;
    delete process.env.PSTDIO_DB_PATH;
    delete process.env.PSTDIO_STORAGE_PATH;

    try {
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
        serve: () => ({}) as ReturnType<typeof Bun.serve>,
        onSignal: () => {},
        offSignal: () => {},
        log: () => {},
      });

      await serveApp({ port: 19840, host: "localhost" });

      expect(process.env.PSTDIO_DB_PATH).toBeUndefined();
      expect(process.env.PSTDIO_STORAGE_PATH).toBeUndefined();
    } finally {
      if (previousDbPath === undefined) {
        delete process.env.PSTDIO_DB_PATH;
      } else {
        process.env.PSTDIO_DB_PATH = previousDbPath;
      }

      if (previousStoragePath === undefined) {
        delete process.env.PSTDIO_STORAGE_PATH;
      } else {
        process.env.PSTDIO_STORAGE_PATH = previousStoragePath;
      }
    }
  });

  it("does not create the app when server startup throws", async () => {
    let created = false;

    const serveApp = createServeApp({
      createApp: async () => {
        created = true;
        return {
          app: {
            fetch: () => new Response("ok"),
          },
          close: async () => {},
        };
      },
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
    expect(created).toBe(false);
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

  it("reports the error when app creation fails", async () => {
    let reportedError: Error | undefined;
    const serveApp = createServeApp({
      createApp: async () => {
        throw new Error("PANIC: could not locate a valid checkpoint record");
      },
      reportStartupError: (error) => {
        reportedError = error;
      },
    });

    await expect(serveApp({ port: 19840, host: "localhost" })).rejects.toThrow("valid checkpoint");
    expect(reportedError?.message).toContain("valid checkpoint");
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
});

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
});

describe("serveApp dashboard config", () => {
  it("bootstraps exact-origin browser auth with an HttpOnly strict cookie", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-dashboard-auth-"));
    let capturedFetch: NonNullable<Parameters<typeof Bun.serve>[0]["fetch"]> | undefined;

    try {
      const serveApp = createServeApp({
        createApp: async (host, onDatabaseLockAcquired) => {
          onDatabaseLockAcquired?.();
          return {
            app: {
              fetch: () =>
                new Response(
                  JSON.stringify({
                    instanceId: host!.instanceId,
                    ok: true,
                    ownerType: host!.ownerType(),
                    protocolVersion: 1,
                  }),
                ),
            },
            close: async () => {},
          };
        },
        injectConfig: (html) => html,
        isCompiledBinary: () => false,
        loadEmbeddedAssets: () => new Map(),
        loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
        resolveMimeType: () => "text/html",
        serve: (options) => {
          capturedFetch = options.fetch;
          return { port: 43123 } as ReturnType<typeof Bun.serve>;
        },
        onSignal: () => {},
        offSignal: () => {},
        onFatal: () => {},
        offFatal: () => {},
        log: () => {},
      });

      await serveApp({
        descriptorPath: join(root, "runtime.json"),
        host: "127.0.0.1",
        instanceId: "runtime-one",
        ownerType: "persistent",
        port: 0,
        token: "runtime-secret",
      });

      const server = {} as Bun.Server<undefined>;
      const response = await capturedFetch?.call(server, new Request("http://127.0.0.1:43123/"), server);
      const foreign = await capturedFetch?.call(server, new Request("http://localhost:43123/"), server);

      expect(response?.headers.getSetCookie()).toEqual([
        "pstdio_runtime_session=runtime-secret; Path=/; HttpOnly; SameSite=Strict",
      ]);
      expect(await response?.text()).not.toContain("runtime-secret");
      expect(foreign?.headers.get("set-cookie")).toBeNull();
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
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

describe("serveApp fatal shutdown", () => {
  it("exits on fatal errors even when close never settles", async () => {
    let fatalListener: ((error: unknown) => void) | undefined;
    let exitCode: number | undefined;

    const serveApp = createServeApp({
      createApp: async () => ({
        app: {
          fetch: () => new Response("ok"),
        },
        close: async () => {
          await new Promise(() => {});
        },
      }),
      injectConfig: (html) => html,
      isCompiledBinary: () => false,
      loadEmbeddedAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      resolveMimeType: () => "text/html",
      serve: () => ({}) as ReturnType<typeof Bun.serve>,
      onFatal: (event, listener) => {
        if (event === "uncaughtException") fatalListener = listener;
      },
      offFatal: () => {},
      onSignal: () => {},
      offSignal: () => {},
      exit: (code = 0) => {
        exitCode = code;
        return undefined as never;
      },
      log: () => {},
      reportStartupError: () => {},
    });

    await serveApp({ port: 19840, host: "localhost" });
    fatalListener?.(new Error("boom"));

    expect(exitCode).toBe(1);
  });
});
