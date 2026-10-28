import { describe, expect, test } from "bun:test";
import { sampleOrder } from "./schedule";

describe("sample order", () => {
  test("commits alternate and swap places every sample", () => {
    expect(sampleOrder(["base", "head"], 3).map((step) => step.commit)).toEqual([
      "base",
      "head",
      "head",
      "base",
      "base",
      "head",
    ]);
  });

  test("every commit gets every sample", () => {
    const steps = sampleOrder(["base", "head"], 10);
    expect(steps.filter((step) => step.commit === "head").map((step) => step.sample)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  test("a single commit runs once per sample", () => {
    expect(sampleOrder(["release"], 2)).toEqual([
      { commit: "release", sample: 0 },
      { commit: "release", sample: 1 },
    ]);
  });
});
