import { describe, expect, test } from "bun:test";
import { collectWorkspaceChangedFilePaths, transformWorkspaceFileDiffs } from "./workspace-review-data";

describe("workspace review data", () => {
  test("maps workspace diff files into diff viewer data", () => {
    const files = [
      {
        filePath: "src/old.ts",
        oldPath: "src/old.ts",
        newPath: "src/new.ts",
        change: "renamed" as const,
        oldContent: "old",
        newContent: "new",
        additions: 2,
        deletions: 1,
      },
      {
        filePath: "README.md",
        change: "modified" as const,
        additions: 1,
        deletions: 0,
      },
    ];

    expect(collectWorkspaceChangedFilePaths(files)).toEqual(["src/new.ts", "README.md"]);
    expect(transformWorkspaceFileDiffs(files)).toEqual([
      {
        change: "renamed",
        oldPath: "src/old.ts",
        newPath: "src/new.ts",
        oldContent: "old",
        newContent: "new",
        additions: 2,
        deletions: 1,
      },
      {
        change: "modified",
        oldPath: "README.md",
        newPath: "README.md",
        oldContent: undefined,
        newContent: undefined,
        additions: 1,
        deletions: 0,
      },
    ]);
  });
});
