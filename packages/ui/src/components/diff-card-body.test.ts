import { describe, expect, it } from "bun:test";
import { createDiffCardBodyModel } from "./diff-card-body";

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
});
