import { describe, expect, test } from "bun:test";
import { resolveBuildTargets } from "./build-targets";

const buildTargets = [
  { target: "bun-linux-x64", pkg: "cli-linux-x64", bin: "pstdio" },
  { target: "bun-windows-x64", pkg: "cli-win-x64", bin: "pstdio.exe" },
];

describe("build target resolver", () => {
  test("uses every configured target by default", () => {
    expect(resolveBuildTargets(buildTargets)).toEqual(buildTargets);
  });

  test("selects the requested platform package", () => {
    expect(resolveBuildTargets(buildTargets, "cli-win-x64")).toEqual([buildTargets[1]]);
  });

  test("fails when the requested platform package is not configured", () => {
    expect(() => resolveBuildTargets(buildTargets, "cli-missing-x64")).toThrow(
      "No compiled build target is configured for PSTDIO_BUILD_PLATFORM_PKG=cli-missing-x64",
    );
  });
});
