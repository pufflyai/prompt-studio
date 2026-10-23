import { describe, expect, test } from "bun:test";
import { resolvePackagedRuntimeTestArgs } from "./packaged-runtime-smoke";

describe("resolvePackagedRuntimeTestArgs", () => {
  test("runs the complete packaged suite on Linux and Apple Silicon", () => {
    expect(resolvePackagedRuntimeTestArgs({ pkg: "cli-linux-x64" })).toEqual(["run", "test:packaged"]);
    expect(resolvePackagedRuntimeTestArgs({ pkg: "cli-darwin-arm64" })).toEqual(["run", "test:packaged"]);
  });

  test("runs only the essential CLI, runtime and extension page checks on Intel macOS", () => {
    expect(resolvePackagedRuntimeTestArgs({ pkg: "cli-darwin-x64" })).toEqual([
      "test",
      "src/packaged/packaged.test.ts",
      "src/packaged/runtime-lifecycle.test.ts",
      "src/packaged/packaged-storage-upgrade.test.ts",
      "src/packaged/performance-observer.test.ts",
      "src/packaged/npm-entrypoint.test.ts",
      "src/packaged/harness-npm-detection.test.ts",
      "src/packaged/codex-transport.test.ts",
      "src/packaged/extension-smoke.test.ts",
      "src/packaged/extension-browser-install.test.ts",
      "src/packaged/extension-dependency-loading.test.ts",
      "--timeout",
      "60000",
      "--silent",
    ]);
  });

  test("runs runtime lifecycle, Codex transport, npm harness detection and supported browser setup checks on Windows", () => {
    expect(resolvePackagedRuntimeTestArgs({ pkg: "cli-win-x64" })).toEqual([
      "test",
      "src/packaged/runtime-lifecycle.test.ts",
      "src/packaged/packaged-storage-upgrade.test.ts",
      "src/packaged/performance-observer.test.ts",
      "src/packaged/harness-npm-detection.test.ts",
      "src/packaged/codex-transport.test.ts",
      "src/packaged/extension-browser-install.test.ts",
      "--timeout",
      "30000",
      "--silent",
    ]);
    expect(resolvePackagedRuntimeTestArgs({ pkg: "cli-win-arm64" })).toEqual([
      "test",
      "src/packaged/runtime-lifecycle.test.ts",
      "src/packaged/packaged-storage-upgrade.test.ts",
      "src/packaged/performance-observer.test.ts",
      "src/packaged/harness-npm-detection.test.ts",
      "src/packaged/codex-transport.test.ts",
      "--timeout",
      "30000",
      "--silent",
    ]);
  });
});
