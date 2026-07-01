import { describe, expect, it } from "bun:test";
import { ANCHOR_GRID_VALUES, isAnchorGridValue } from "./anchor-grid";

describe("ANCHOR_GRID_VALUES", () => {
  it("has nine anchors in row-major order", () => {
    expect(ANCHOR_GRID_VALUES).toHaveLength(9);
    expect(ANCHOR_GRID_VALUES[0]).toBe("top-left");
    expect(ANCHOR_GRID_VALUES[4]).toBe("center");
    expect(ANCHOR_GRID_VALUES[8]).toBe("bottom-right");
  });
});

describe("isAnchorGridValue", () => {
  it("accepts supported anchors", () => {
    expect(isAnchorGridValue("center")).toBe(true);
  });

  it("rejects unknown or non-string values", () => {
    expect(isAnchorGridValue("middle")).toBe(false);
    expect(isAnchorGridValue(42)).toBe(false);
  });
});
