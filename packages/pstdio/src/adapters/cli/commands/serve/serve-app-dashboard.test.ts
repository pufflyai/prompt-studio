import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import packageData from "../../../../../package.json";

import { createServeApp } from "./serve-app";

describe("serveApp dashboard config", () => {
  it("does not give an unauthenticated page load a session cookie", async () => {
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
      for (const path of ["/", "/projects/any/page"]) {
        const response = await capturedFetch?.call(server, new Request(`http://127.0.0.1:43123${path}`), server);

        expect(response?.headers.getSetCookie()).toEqual([]);
        expect(await response?.text()).not.toContain("runtime-secret");
      }
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
