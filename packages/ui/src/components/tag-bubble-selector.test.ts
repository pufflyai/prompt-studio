import { describe, expect, it } from "bun:test";

import { resolveTagBubbleSelection } from "./tag-bubble-selector";

describe("resolveTagBubbleSelection", () => {
  it("selects and clears a single-select option by toggling the same item", () => {
    expect(resolveTagBubbleSelection([], "feature", "single")).toEqual(["feature"]);
    expect(resolveTagBubbleSelection(["feature"], "feature", "single")).toEqual([]);
    expect(resolveTagBubbleSelection(["bug"], "feature", "single")).toEqual(["feature"]);
  });

  it("adds and removes multi-select options without clearing the rest", () => {
    expect(resolveTagBubbleSelection(["api"], "dashboard", "multiple")).toEqual(["api", "dashboard"]);
    expect(resolveTagBubbleSelection(["api", "dashboard"], "api", "multiple")).toEqual(["dashboard"]);
  });
});
