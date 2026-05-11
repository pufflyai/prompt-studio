import { describe, expect, it } from "bun:test";
import { createDiffCardBodyModel, type TestDiffViewData } from "./diff-card-body";

describe("createDiffCardBodyModel", () => {
  it("does not build diff view data for loaded large diffs before opt-in", () => {
    const model = createDiffCardBodyModel({
      diff: { change: "modified", oldPath: "large.txt", newPath: "large.txt", additions: 1001 },
      filePath: "large.txt",
      oldContent: "old",
      newContent: "new",
      isLargeDiff: true,
      hasOptedIntoLargeDiff: false,
      buildViewData: () => {
        throw new Error("diff view data should not be built");
      },
    });

    expect(model.kind).toBe("placeholder");
  });

  it("renders small changes even when rendered hunk output is large", () => {
    const model = createDiffCardBodyModel({
      diff: { change: "modified", oldPath: "large-file.txt", newPath: "large-file.txt", additions: 19, deletions: 19 },
      filePath: "large-file.txt",
      oldContent: "old",
      newContent: "new",
      isLargeDiff: false,
      hasOptedIntoLargeDiff: false,
      buildViewData: () => buildDiffViewDataWithRenderedLines(1200),
    });

    expect(model.kind).toBe("editor");
  });
});

const buildDiffViewDataWithRenderedLines = (lineCount: number): TestDiffViewData => ({
  oldFile: {
    fileName: "before.txt",
    fileLang: "plaintext",
    content: "",
  },
  newFile: {
    fileName: "after.txt",
    fileLang: "plaintext",
    content: "",
  },
  hunks: [Array.from({ length: lineCount }, (_, index) => `line ${index + 1}`).join("\n")],
});
