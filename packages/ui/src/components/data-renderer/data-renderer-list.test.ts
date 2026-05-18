import { describe, expect, it } from "bun:test";

import { getDataRendererListIndentation } from "./data-renderer-list";

describe("getDataRendererListIndentation", () => {
  it("does not indent top-level rows", () => {
    expect(getDataRendererListIndentation(0)).toBeUndefined();
  });

  it("uses compact depth indentation", () => {
    expect(getDataRendererListIndentation(1)).toBe("12px");
    expect(getDataRendererListIndentation(2)).toBe("24px");
  });
});
