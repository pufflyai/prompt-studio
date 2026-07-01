import { describe, expect, it } from "bun:test";
import { updateVectorAxis } from "./vector-value";

describe("updateVectorAxis", () => {
  it("updates x while keeping y", () => {
    expect(updateVectorAxis({ x: 1, y: 2 }, "x", 5)).toEqual({ x: 5, y: 2 });
  });

  it("updates y while keeping x", () => {
    expect(updateVectorAxis({ x: 1, y: 2 }, "y", 5)).toEqual({ x: 1, y: 5 });
  });

  it("clamps into bounds when provided", () => {
    expect(updateVectorAxis({ x: 0, y: 0 }, "x", 500, { min: -100, max: 100 })).toEqual({ x: 100, y: 0 });
  });

  it("passes values through without bounds", () => {
    expect(updateVectorAxis({ x: 0, y: 0 }, "y", -9999)).toEqual({ x: 0, y: -9999 });
  });
});
