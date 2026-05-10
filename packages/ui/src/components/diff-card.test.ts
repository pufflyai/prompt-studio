import { describe, expect, it } from "bun:test";
import { shouldAutoLoadDiffContent } from "./diff-card";

describe("shouldAutoLoadDiffContent", () => {
  it("auto-loads only the selected expanded summary diff", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: false,
        isLargeDiff: false,
        requestedPath: null,
        filePath: "src/app.ts",
      }),
    ).toBe(true);

    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: false,
        hasDiffContent: false,
        isLargeDiff: false,
        requestedPath: null,
        filePath: "src/app.ts",
      }),
    ).toBe(false);
  });

  it("does not retry an already requested path automatically", () => {
    expect(
      shouldAutoLoadDiffContent({
        isExpanded: true,
        isSelected: true,
        hasDiffContent: false,
        isLargeDiff: false,
        requestedPath: "src/app.ts",
        filePath: "src/app.ts",
      }),
    ).toBe(false);
  });
});
