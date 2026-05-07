import { describe, expect, test } from "bun:test";
import { shouldRunPackagedRuntimeSmoke } from "./packaged-runtime-smoke";

describe("packaged runtime smoke selection", () => {
  test("runs for Unix platform packages", () => {
    expect(shouldRunPackagedRuntimeSmoke({ pkg: "cli-linux-x64" })).toBe(true);
    expect(shouldRunPackagedRuntimeSmoke({ pkg: "cli-darwin-x64" })).toBe(true);
  });

  test("skips Windows platform packages", () => {
    expect(shouldRunPackagedRuntimeSmoke({ pkg: "cli-win-x64" })).toBe(false);
  });
});
