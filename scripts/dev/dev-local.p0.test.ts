import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { resolveLocalDevelopmentEnv } from "./dev-local";

describe("local development environment", () => {
  test("refreshes default extensions without preinstalling optional tools", () => {
    const env = resolveLocalDevelopmentEnv("/repo", {});
    const config = JSON.parse(env.PSTDIO_DEFAULT_EXTENSIONS) as {
      defaultExtensions: Array<Record<string, unknown>>;
    };

    expect(config.defaultExtensions).toContainEqual({
      force: true,
      installName: "pstdio-base-themes",
      skipInstall: true,
      source: resolve("/repo/extensions/pstdio-base-themes"),
    });
    expect(config.defaultExtensions.every((extension) => extension.force === true)).toBe(true);
    expect(config.defaultExtensions.map((extension) => extension.installName)).not.toContain("harness-codex");
    expect(config.defaultExtensions.map((extension) => extension.installName)).not.toContain("pstdio-planner");
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
