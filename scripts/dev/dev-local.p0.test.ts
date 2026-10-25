import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { resolveLocalDevelopmentEnv } from "./dev-local";

describe("local development environment", () => {
  test("refreshes first-party extensions from the working tree", () => {
    const env = resolveLocalDevelopmentEnv("/repo", {});
    const config = JSON.parse(env.PSTDIO_DEFAULT_EXTENSIONS) as {
      defaultExtensions: Array<Record<string, unknown>>;
    };

    expect(config.defaultExtensions).toContainEqual({
      force: true,
      installName: "extension-lab",
      skipInstall: true,
      source: resolve("/repo/extensions/extension-lab"),
    });
    expect(config.defaultExtensions.every((extension) => extension.force === true)).toBe(true);
  });

  test("keeps explicit environment overrides", () => {
    const env = resolveLocalDevelopmentEnv("/repo", {
      PSTDIO_API_URL: "http://127.0.0.1:4000",
      PSTDIO_DEFAULT_EXTENSIONS: '["custom-extension"]',
      PSTDIO_HOME: "/tmp/custom-pstdio-home",
    });

    expect(env.PSTDIO_API_URL).toBe("http://127.0.0.1:4000");
    expect(env.PSTDIO_DEFAULT_EXTENSIONS).toBe('["custom-extension"]');
    expect(env.PSTDIO_HOME).toBe("/tmp/custom-pstdio-home");
  });
});
