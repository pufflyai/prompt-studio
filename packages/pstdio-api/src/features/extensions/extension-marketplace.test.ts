import { describe, expect, test } from "bun:test";
import { defaultExtensions } from "./default-extensions";
import { getMarketplaceExtension, marketplaceExtensionRepositoryPath } from "./extension-marketplace";
import { namedSourceRef, PSTDIO_REPOSITORY_URL } from "./install-extension-source";

describe("extension marketplace", () => {
  test("ships Planner Automations as a default repo-scoped GitHub extension", () => {
    expect(getMarketplaceExtension("pstdio-planner-loops")).toMatchObject({
      displayName: "Prompt Studio Planner Automation",
      installName: "pstdio-planner-loops",
      repositoryPath: ".pstdio/extensions/pstdio-planner-loops",
      scope: "repo",
    });
    expect(marketplaceExtensionRepositoryPath("pstdio-planner-loops")).toBe(".pstdio/extensions/pstdio-planner-loops");
    expect(namedSourceRef("0123456789abcdef0123456789abcdef01234567", "pstdio-planner-loops")).toBe(
      `${PSTDIO_REPOSITORY_URL}@0123456789abcdef0123456789abcdef01234567#.pstdio/extensions/pstdio-planner-loops`,
    );
    expect(defaultExtensions.defaultExtensions).toContain("pstdio-planner-loops");
  });
});
