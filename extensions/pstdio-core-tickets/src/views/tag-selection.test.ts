import { describe, expect, test } from "bun:test";
import { nextTagSelection } from "./tag-selection";

const tag = (type: "single_select" | "multi_select") => ({
  type,
  options: [{ id: "red" }, { id: "blue" }],
});

describe("nextTagSelection", () => {
  test("replaces the selected option for single-select tags", () => {
    expect(nextTagSelection({ current: ["other", "red"], optionId: "blue", tag: tag("single_select") })).toEqual([
      "other",
      "blue",
    ]);
  });

  test("clears the selected option for single-select tags", () => {
    expect(nextTagSelection({ current: ["other", "red"], optionId: "red", tag: tag("single_select") })).toEqual([
      "other",
    ]);
  });

  test("toggles options for multi-select tags", () => {
    expect(nextTagSelection({ current: ["other", "red"], optionId: "blue", tag: tag("multi_select") })).toEqual([
      "other",
      "red",
      "blue",
    ]);

    expect(nextTagSelection({ current: ["other", "red", "blue"], optionId: "red", tag: tag("multi_select") })).toEqual([
      "other",
      "blue",
    ]);
  });
});
