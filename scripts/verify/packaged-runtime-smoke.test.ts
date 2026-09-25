import { describe, expect, test } from "bun:test";
import { resolvePackagedRuntimeTestArgs } from "./packaged-runtime-smoke";

describe("resolvePackagedRuntimeTestArgs", () => {
  test("runs the complete packaged suite on Unix hosts", () => {
    expect(resolvePackagedRuntimeTestArgs({ pkg: "cli-linux-x64" })).toEqual(["run", "test:packaged"]);
    expect(resolvePackagedRuntimeTestArgs({ pkg: "cli-darwin-x64" })).toEqual(["run", "test:packaged"]);
  });

  test("runs runtime lifecycle and supported browser setup checks on Windows", () => {
    const expected = ["test", "src/packaged/runtime-lifecycle.test.ts", "--timeout", "30000", "--silent"];

    expect(resolvePackagedRuntimeTestArgs({ pkg: "cli-win-x64" })).toEqual([
      "test",
      "src/packaged/runtime-lifecycle.test.ts",
      "src/packaged/extension-browser-install.test.ts",
      "--timeout",
      "30000",
      "--silent",
    ]);
    expect(resolvePackagedRuntimeTestArgs({ pkg: "cli-win-arm64" })).toEqual(expected);
  });
});
