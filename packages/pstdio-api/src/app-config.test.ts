import { describe, expect, test } from "bun:test";
import { resolveAppConfig } from "./app-config";

describe("resolveAppConfig", () => {
  test("resolves supported environment values", () => {
    const config = resolveAppConfig({
      env: {
        HOME: "/home/tester",
        PSTDIO_DB_PATH: "~/data/database",
        PSTDIO_EVENT_BUS_BUFFER_SIZE: "25.9",
        PSTDIO_EXTENSION_RELEASE_REF: "pstdio@1.2.3",
        PSTDIO_EXTENSION_SOURCE_ROOT: "/workspace/pstdio",
        PSTDIO_EXTENSION_WEBVIEW_BUILDS: "0",
        PSTDIO_STORAGE_PATH: "~/data/storage",
        PSTDIO_TERMINAL_ORIGINS: "http://one.test, ,http://two.test",
      },
    });

    expect(config).toEqual({
      database: { path: "/home/tester/data/database" },
      extensions: {
        buildWebviews: false,
        release: { source: "workspace", ref: "pstdio@1.2.3", root: "/workspace/pstdio" },
      },
      storage: { root: "/home/tester/data/storage" },
      sync: { eventBufferSize: 25 },
      transport: { terminalOrigins: ["http://one.test", "http://two.test"] },
    });
  });

  test("uses the caller release ref when the environment does not provide one", () => {
    const config = resolveAppConfig({
      defaultExtensionReleaseRef: "pstdio@2.0.0",
      env: { HOME: "/home/tester" },
    });

    expect(config.extensions.release).toEqual({ source: "git", ref: "pstdio@2.0.0" });
    expect(config.sync.eventBufferSize).toBe(1000);
  });

  test("rejects a workspace source without a release ref", () => {
    expect(() =>
      resolveAppConfig({
        env: { PSTDIO_EXTENSION_SOURCE_ROOT: "/workspace/pstdio" },
      }),
    ).toThrow("PSTDIO_EXTENSION_SOURCE_ROOT requires PSTDIO_EXTENSION_RELEASE_REF");
  });
});
