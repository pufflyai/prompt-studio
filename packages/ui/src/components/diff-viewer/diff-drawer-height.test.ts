import { describe, expect, it } from "bun:test";
import { estimateDiffCardHeight } from "./diff-drawer-height";

describe("estimateDiffCardHeight", () => {
  it("reserves preview height for loaded image diffs", () => {
    expect(
      estimateDiffCardHeight({
        diff: {
          change: "modified",
          oldPath: "assets/logo.png",
          newPath: "assets/logo.png",
          oldContent: "data:image/png;base64,b2xk",
          newContent: "data:image/png;base64,bmV3",
        },
        isCollapsed: false,
      }),
    ).toBe(380);
  });

  it("uses deferred height for unloaded image summaries", () => {
    expect(
      estimateDiffCardHeight({
        diff: {
          change: "modified",
          oldPath: "assets/logo.png",
          newPath: "assets/logo.png",
        },
        isCollapsed: false,
      }),
    ).toBe(130);
  });
});
