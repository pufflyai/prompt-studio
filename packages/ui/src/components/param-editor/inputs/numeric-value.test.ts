import { describe, expect, it } from "bun:test";
import { clampToRange, formatUnitValue, snapToStep } from "./numeric-value";

describe("clampToRange", () => {
  it("keeps values inside the range", () => {
    expect(clampToRange(5, 0, 10)).toBe(5);
  });

  it("clamps below and above the bounds", () => {
    expect(clampToRange(-3, 0, 10)).toBe(0);
    expect(clampToRange(42, 0, 10)).toBe(10);
  });

  it("tolerates an inverted min/max", () => {
    expect(clampToRange(42, 10, 0)).toBe(10);
  });
});

describe("snapToStep", () => {
  it("snaps to the nearest step from the origin", () => {
    expect(snapToStep(7, 5)).toBe(5);
    expect(snapToStep(8, 5)).toBe(10);
  });

  it("anchors snapping at a custom origin", () => {
    expect(snapToStep(12, 5, 2)).toBe(12);
    expect(snapToStep(14, 5, 2)).toBe(12);
  });

  it("returns the value unchanged for a non-positive step", () => {
    expect(snapToStep(7, 0)).toBe(7);
  });
});

describe("formatUnitValue", () => {
  it("formats integers and decimals with a unit", () => {
    expect(formatUnitValue(72, "%")).toBe("72%");
    expect(formatUnitValue(1.5, "px")).toBe("1.5px");
  });

  it("omits the unit when absent and trims float noise", () => {
    expect(formatUnitValue(0.1 + 0.2)).toBe("0.3");
  });
});
