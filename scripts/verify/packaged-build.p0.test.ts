import { expect, test } from "bun:test";
import { packagedBuildCommand } from "./packaged-build";

test("prebuilt verification never recompiles the artifact being certified", () => {
  expect(packagedBuildCommand(true)).toBeNull();
  expect(packagedBuildCommand(false)).toEqual(["bun", "run", "--cwd", "scripts", "build:all"]);
});

test("queue integrity keeps portable public contracts on Linux and full verification keeps every native permutation", async () => {
  const { packagedVerificationProfile } = await import("./packaged-build");
  for (const platform of ["linux", "darwin", "win32"] as const) {
    const integrity = packagedVerificationProfile("integrity", platform);
    expect(integrity.runtime).toBe(false);
    expect(integrity.publicContracts).toBe(platform === "linux");
    const full = packagedVerificationProfile("full", platform);
    expect(full.runtime).toBe(true);
    expect(full.publicContracts).toBe(true);
  }
  expect(() => packagedVerificationProfile("unknown", "linux")).toThrow();
});
