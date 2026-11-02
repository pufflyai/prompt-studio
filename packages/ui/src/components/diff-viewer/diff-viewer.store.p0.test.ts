import { expect, test } from "bun:test";
import { createDiffViewerStore } from "./diff-viewer.store";

test("diff viewers keep their own selection, search and expanded folders", () => {
  const a = createDiffViewerStore();
  const b = createDiffViewerStore();
  a.getState().setSelectedPath("src/a.ts");
  a.getState().setSearchQuery("source");
  a.getState().setExpandedFolderIds(["src"]);
  b.getState().setSelectedPath("docs/b.md");
  b.getState().setSearchQuery("docs");
  b.getState().setExpandedFolderIds(["docs"]);
  expect(a.getState()).toMatchObject({
    selectedPath: "src/a.ts",
    searchQuery: "source",
    expandedFolderIds: new Set(["src"]),
  });
  expect(b.getState()).toMatchObject({
    selectedPath: "docs/b.md",
    searchQuery: "docs",
    expandedFolderIds: new Set(["docs"]),
  });
});
