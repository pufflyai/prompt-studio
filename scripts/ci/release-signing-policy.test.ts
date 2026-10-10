import { describe, expect, test } from "bun:test";
import { isSigningManifest } from "./release-signing-policy";

const before = {
  name: "pstdio",
  version: "0.41.0",
  scripts: { build: "bun run build.ts" },
  dependencies: { react: "^19.0.0", "@pstdio/sdk": "workspace:*" },
  optionalDependencies: { "@pstdio/cli-win-x64": "0.41.0" },
};
const after = {
  ...before,
  version: "0.42.0",
  optionalDependencies: { "@pstdio/cli-win-x64": "0.42.0" },
};

describe("signed release dependency inputs", () => {
  test("allows version changes and the host's matching compiled CLI versions", () => {
    expect(isSigningManifest(before, after)).toBe(true);
    expect(isSigningManifest(before, before)).toBe(true);
  });

  test.each([
    { dependencies: { ...after.dependencies, react: "^20.0.0" } },
    { dependencies: { ...after.dependencies, "@pstdio/sdk": "^0.42.0" } },
    { optionalDependencies: { "@pstdio/cli-win-x64": "0.43.0" } },
    { optionalDependencies: { "@pstdio/cli-win-x64": "https://example.com/cli.tgz" } },
    { optionalDependencies: { ...after.optionalDependencies, extra: "1.0.0" } },
    { scripts: { build: "bun run other.ts" } },
  ])("rejects dependency or script changes outside generated CLI versions: %j", (change) => {
    expect(isSigningManifest(before, { ...after, ...change })).toBe(false);
  });

  test("other packages cannot redirect compiled CLI dependencies", () => {
    expect(isSigningManifest({ ...before, name: "example" }, { ...after, name: "example" })).toBe(false);
  });
});
