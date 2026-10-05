import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RuntimeHost } from "pstdio-api/runtime";

import { createServeApp } from "./serve-app";

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

describe("serveApp fatal shutdown", () => {
  it("closes the app before it exits on a fatal error", async () => {
    let fatalListener: ((error: unknown) => void) | undefined;
    const closeGate = Promise.withResolvers<void>();
    const exited = Promise.withResolvers<{ code: number; closed: boolean }>();
    let closed = false;

    const serveApp = createServeApp({
      createApp: async () => ({
        app: { fetch: () => new Response("ok") },
        close: async () => {
          await closeGate.promise;
          closed = true;
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
        exited.resolve({ code, closed });
        return undefined as never;
      },
      log: () => {},
      reportStartupError: () => {},
    });

    await serveApp({ port: 19840, host: "localhost" });
    fatalListener?.(new Error("boom"));
    await Bun.sleep(10);
    closeGate.resolve();

    expect(await exited.promise).toEqual({ code: 1, closed: true });
  });

  it("exits on fatal errors even when close never settles", async () => {
    let fatalListener: ((error: unknown) => void) | undefined;
    const exited = Promise.withResolvers<number>();

    const serveApp = createServeApp({
      fatalCloseTimeoutMs: 10,
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
        exited.resolve(code);
        return undefined as never;
      },
      log: () => {},
      reportStartupError: () => {},
    });

    await serveApp({ port: 19840, host: "localhost" });
    fatalListener?.(new Error("boom"));

    expect(await exited.promise).toBe(1);
  });
});

describe("serveApp fatal shutdown during close", () => {
  it("keeps handling fatal errors until the app has closed", async () => {
    const fatalListeners = new Map<string, (error: unknown) => void>();
    const removedFatalListeners: string[] = [];
    const closeGate = Promise.withResolvers<void>();
    const exits: number[] = [];
    let closes = 0;

    const serveApp = createServeApp({
      createApp: async () => ({
        app: { fetch: () => new Response("ok") },
        close: async () => {
          closes += 1;
          await closeGate.promise;
        },
      }),
      injectConfig: (html) => html,
      isCompiledBinary: () => false,
      loadEmbeddedAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      loadFilesystemAssets: () => new Map([["index.html", new Blob(["<html></html>"])]]),
      resolveMimeType: () => "text/html",
      serve: () => ({}) as ReturnType<typeof Bun.serve>,
      onFatal: (event, listener) => {
        fatalListeners.set(event, listener);
      },
      offFatal: (event) => {
        removedFatalListeners.push(event);
      },
      onSignal: () => {},
      offSignal: () => {},
      exit: (code = 0) => {
        exits.push(code);
        return undefined as never;
      },
      log: () => {},
      reportStartupError: () => {},
    });

    await serveApp({ port: 19840, host: "localhost" });
    fatalListeners.get("uncaughtException")?.(new Error("first"));
    fatalListeners.get("unhandledRejection")?.(new Error("second, during close"));
    await Bun.sleep(10);

    expect(removedFatalListeners).toEqual([]);
    expect(exits).toEqual([]);

    closeGate.resolve();
    await Bun.sleep(10);

    expect(closes).toBe(1);
    expect(exits).toEqual([1]);
  });
});
