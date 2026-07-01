import { describe, expect, it } from "bun:test";
import { normalizeRange, updateRangeHandle } from "./range-value";

describe("normalizeRange", () => {
  it("orders a reversed pair", () => {
    expect(normalizeRange([80, 20], 0, 100)).toEqual([20, 80]);
  });

  it("clamps both ends into range", () => {
    expect(normalizeRange([-10, 140], 0, 100)).toEqual([0, 100]);
  });

  it("snaps to the step grid", () => {
    expect(normalizeRange([12, 84], 0, 100, 5)).toEqual([10, 85]);
  });
});

describe("updateRangeHandle", () => {
  it("updates the start handle", () => {
    expect(updateRangeHandle([20, 80], 0, 40, 0, 100)).toEqual([40, 80]);
  });

  it("keeps the pair ordered when handles cross", () => {
    expect(updateRangeHandle([20, 80], 0, 95, 0, 100)).toEqual([80, 95]);
  });
});
