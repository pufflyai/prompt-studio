import { describe, expect, it } from "bun:test";
import { buildChangedFilesTree, collectChangedFilePaths } from "./build-changed-files-tree";

describe("collectChangedFilePaths", () => {
  it("uses newPath when available and falls back to oldPath or filePath", () => {
    const paths = collectChangedFilePaths([
      {
        filePath: "src/old.ts",
        change: "renamed",
        additions: 0,
        deletions: 0,
        oldContent: "",
        newContent: "",
        oldPath: "src/old.ts",
        newPath: "src/new.ts",
      },
      {
        filePath: "src/deleted.ts",
        change: "deleted",
        additions: 0,
        deletions: 1,
        oldContent: "x",
        newContent: "",
        oldPath: "src/deleted.ts",
      },
      {
        filePath: "README.md",
        change: "modified",
        additions: 1,
        deletions: 1,
        oldContent: "a",
        newContent: "b",
      },
    ]);

    expect(paths).toEqual(["src/new.ts", "src/deleted.ts", "README.md"]);
  });
});

describe("buildChangedFilesTree", () => {
  it("builds a nested tree with stable folder and file ids", () => {
    const nestedTree = buildChangedFilesTree(["src/app/main.ts", "src/lib/helpers.ts", "README.md"], "nested");

    expect(nestedTree).toEqual([
      {
        id: "folder:src",
        name: "src",
        type: "folder",
        children: [
          {
            id: "folder:src/app",
            name: "app",
            type: "folder",
            children: [{ id: "file:src/app/main.ts", name: "main.ts", type: "file" }],
          },
          {
            id: "folder:src/lib",
            name: "lib",
            type: "folder",
            children: [{ id: "file:src/lib/helpers.ts", name: "helpers.ts", type: "file" }],
          },
        ],
      },
      { id: "file:README.md", name: "README.md", type: "file" },
    ]);
  });

  it("builds a flat tree with full file paths", () => {
    const flatTree = buildChangedFilesTree(["src/lib/helpers.ts", "README.md"], "flat");

    expect(flatTree).toEqual([
      { id: "file:README.md", name: "README.md", type: "file" },
      { id: "file:src/lib/helpers.ts", name: "src/lib/helpers.ts", type: "file" },
    ]);
  });
});
