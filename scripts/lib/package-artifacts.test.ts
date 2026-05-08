import { describe, expect, test } from "bun:test";
import { createPackageArtifactBuildArgs } from "./package-artifacts";

describe("package artifact build command", () => {
  test("uses the Lerna/Nx build graph for packaged artifacts", () => {
    const args = createPackageArtifactBuildArgs();

    expect(args).toEqual([
      "run",
      "build",
      "--",
      "--scope",
      "pstdio-dashboard",
      "--scope",
      "pstdio-api",
      "--include-dependencies",
      "--stream",
    ]);
  });
});
