import { describe, expect, it } from "bun:test";
import { estimateDiffCardHeight } from "./diff-drawer-height";

describe("estimateDiffCardHeight", () => {
  it("reserves preview height for loaded image diffs beyond an unloaded image summary", () => {
    const summary = { change: "modified" as const, oldPath: "assets/logo.png", newPath: "assets/logo.png" };
    const loaded = {
      ...summary,
      oldContent: "data:image/png;base64,b2xk",
      newContent: "data:image/png;base64,bmV3",
    };

    expect(estimateDiffCardHeight({ diff: loaded, isCollapsed: false })).toBeGreaterThan(
      estimateDiffCardHeight({ diff: summary, isCollapsed: false }),
    );
  });
});
