import { describe, expect, it } from "bun:test";
import type { ApiFileDiff } from "@/shared/api-types";
import { transformFileDiffs } from "./transform-diff";

describe("transformFileDiffs", () => {
  it("keeps summary-only files free of body content", () => {
    const files: ApiFileDiff[] = [
      {
        filePath: "large.ts",
        change: "modified",
        additions: 10,
        deletions: 2,
      },
    ];

    expect(transformFileDiffs(files)).toEqual([
      {
        change: "modified",
        oldPath: "large.ts",
        newPath: "large.ts",
        oldContent: undefined,
        newContent: undefined,
        additions: 10,
        deletions: 2,
      },
    ]);
  });
});
