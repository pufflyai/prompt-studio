import { describe, expect, it } from "bun:test";
import { filterMenuOptions } from "./filter-menu-options";

const options = [
  { label: "prompt-studio", value: "prompt-studio" },
  { label: "pstdio-api", value: "pstdio-api" },
  { label: "feature/main-cleanup", value: "feature/main-cleanup" },
];

describe("filterMenuOptions", () => {
  it("returns all options when query is empty", () => {
    expect(filterMenuOptions(options, "")).toEqual(options);
    expect(filterMenuOptions(options, "   ")).toEqual(options);
  });

  it("filters options by label with case-insensitive match", () => {
    const filtered = filterMenuOptions(options, "API");

    expect(filtered).toEqual([{ label: "pstdio-api", value: "pstdio-api" }]);
  });

  it("filters options by value", () => {
    const filtered = filterMenuOptions(options, "main-cleanup");

    expect(filtered).toEqual([{ label: "feature/main-cleanup", value: "feature/main-cleanup" }]);
  });
});
