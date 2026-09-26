import { describe, expect, test } from "bun:test";
import { checkExtensionUiVersion } from "./verify-boundaries";

const verify = (version: string, isExtension = true) => {
  const errors: string[] = [];
  checkExtensionUiVersion(
    {
      name: "example",
      dir: "extensions/example",
      declared: new Set(["@pstdio/ui"]),
      dependencies: { "@pstdio/ui": version },
      isExtension,
    },
    errors,
  );
  return errors;
};

describe("extension UI dependency versions", () => {
  test("keeps a published UI pin while a new core release is prepared", () => {
    expect(verify("0.26.0")).toEqual([]);
    expect(verify("0.26.1")).toEqual([]);
  });

  test.each(["^0.26.1", "~0.26.1", "workspace:*", "latest", "*"])("rejects the unpinned version %s", (version) => {
    expect(verify(version)).toHaveLength(1);
  });

  test("allows core packages to follow workspace dependencies", () => {
    expect(verify("workspace:*", false)).toEqual([]);
  });
});
