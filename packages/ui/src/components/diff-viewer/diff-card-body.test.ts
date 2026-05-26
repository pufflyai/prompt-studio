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

  it("returns a binary placeholder for image files instead of building diff view data", () => {
    const model = createDiffCardBodyModel({
      diff: { change: "modified", oldPath: "logo.png", newPath: "logo.png", additions: 0, deletions: 0 },
      filePath: "logo.png",
      oldContent: "",
      newContent: "",
      isLargeDiff: false,
      hasOptedIntoLargeDiff: false,
      buildViewData: () => {
        throw new Error("diff view data should not be built for binary files");
      },
    });

    expect(model.kind).toBe("binary");
    if (model.kind === "binary") {
      expect(model.isImage).toBe(true);
      expect(model.filePath).toBe("logo.png");
    }
  });

  it("returns a binary placeholder for non-image binary files", () => {
    const model = createDiffCardBodyModel({
      diff: { change: "modified", oldPath: "docs/spec.pdf", newPath: "docs/spec.pdf" },
      filePath: "docs/spec.pdf",
      oldContent: "",
      newContent: "",
      isLargeDiff: false,
      hasOptedIntoLargeDiff: false,
      buildViewData: () => {
        throw new Error("diff view data should not be built for binary files");
      },
    });

    expect(model.kind).toBe("binary");
    if (model.kind === "binary") {
      expect(model.isImage).toBe(false);
    }
  });

  it("uses split editor layout when requested", () => {
    const model = createDiffCardBodyModel({
      diff: { change: "modified", oldPath: "file.txt", newPath: "file.txt", additions: 1 },
      filePath: "file.txt",
      oldContent: "old",
      newContent: "new",
      isLargeDiff: false,
      hasOptedIntoLargeDiff: false,
      diffViewMode: "split",
      buildViewData: () => buildDiffViewDataWithRenderedLines(1),
    });

    expect(model.kind).toBe("editor");
    if (model.kind === "editor") {
      expect(model.sideBySide).toBe(true);
    }
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
  unifiedContentRows: lineCount,
  splitContentRows: lineCount,
  hunkRows: 1,
});
