import { describe, expect, test } from "bun:test";
import { repositoryDocUrl, resolveRepositoryDocPathFromUrl } from "./repository-doc-route";

const documentPaths = new Set(["product/cli/index.md", "product/cli/agents.md"]);

describe("repository documentation routes", () => {
  test("uses clean URLs for overview documents and markdown files", () => {
    expect(repositoryDocUrl("product/cli/index.md")).toBe("/documentation/product/cli");
    expect(repositoryDocUrl("product/cli/agents.md")).toBe("/documentation/product/cli/agents");
  });

  test("resolves only URLs backed by repository documents", () => {
    expect(resolveRepositoryDocPathFromUrl("/documentation/product/cli", documentPaths)).toBe("product/cli/index.md");
    expect(resolveRepositoryDocPathFromUrl("/documentation/product/cli/agents", documentPaths)).toBe(
      "product/cli/agents.md",
    );
    expect(resolveRepositoryDocPathFromUrl("/documentation/unknown", documentPaths)).toBeUndefined();
  });

  test("leaves the documentation home to the landing route", () => {
    expect(resolveRepositoryDocPathFromUrl("/documentation", documentPaths)).toBeUndefined();
  });
});
