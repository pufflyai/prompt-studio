import { describe, expect, test } from "bun:test";
import { repositoryDocUrl, resolveRepositoryDocPathFromUrl } from "./repository-doc-route";

const documentPaths = new Set(["index.md", "product/cli/index.md", "architecture/api.md"]);

describe("repository documentation routes", () => {
  test("uses clean URLs for overview documents and markdown files", () => {
    expect(repositoryDocUrl("index.md")).toBe("/documentation");
    expect(repositoryDocUrl("product/cli/index.md")).toBe("/documentation/product/cli");
    expect(repositoryDocUrl("architecture/api.md")).toBe("/documentation/architecture/api");
  });

  test("resolves only URLs backed by repository documents", () => {
    expect(resolveRepositoryDocPathFromUrl("/documentation/product/cli", documentPaths)).toBe("product/cli/index.md");
    expect(resolveRepositoryDocPathFromUrl("/documentation/architecture/api", documentPaths)).toBe(
      "architecture/api.md",
    );
    expect(resolveRepositoryDocPathFromUrl("/documentation/unknown", documentPaths)).toBeUndefined();
  });
});
