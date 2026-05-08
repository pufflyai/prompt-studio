import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { buildCompiledBunSmokePlan, createCompiledBunSmokeFixture, getHostPlatformPackage } from "./compiled-bun-smoke";

describe("compiled Bun smoke helpers", () => {
  test("selects the packaged binary for the current host platform", () => {
    const os = process.platform === "win32" ? "win" : process.platform;
    const pkg = `cli-${os}-${process.arch}`;
    const platformPackage = getHostPlatformPackage([
      { pkg: "cli-unrelated-x64", bin: "pstdio" },
      { pkg, bin: process.platform === "win32" ? "pstdio.exe" : "pstdio" },
    ]);

    expect(platformPackage.pkg).toBe(pkg);
  });

  test("allows CI to select a specific packaged binary", () => {
    const platformPackage = getHostPlatformPackage(
      [
        { pkg: "cli-linux-x64", bin: "pstdio" },
        { pkg: "cli-win-x64", bin: "pstdio.exe" },
      ],
      "cli-win-x64",
    );

    expect(platformPackage.pkg).toBe("cli-win-x64");
  });

  test("builds an isolated install and browser build smoke plan", () => {
    const fixture = createCompiledBunSmokeFixture();

    try {
      const plan = buildCompiledBunSmokePlan({
        binPath: "/repo/packages/pstdio/dist/platforms/cli-darwin-arm64/bin/pstdio",
        fixture,
      });

      expect(plan.install.args).toEqual(["install", "--ignore-scripts"]);
      expect(plan.build.args).toEqual([
        "build",
        join(fixture.extensionDir, "src", "entry.ts"),
        "--target=browser",
        "--format=esm",
        "--outfile",
        join(fixture.extensionDir, "dist", "entry.js"),
      ]);
      expect(plan.install.env.BUN_BE_BUN).toBe("1");
      expect(plan.build.env.BUN_BE_BUN).toBe("1");
      expect(plan.install.env.BUN_INSTALL_CACHE_DIR).toBe(fixture.cacheDir);
      expect(plan.build.env.BUN_INSTALL_CACHE_DIR).toBe(fixture.cacheDir);
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true });
    }
  });
});
