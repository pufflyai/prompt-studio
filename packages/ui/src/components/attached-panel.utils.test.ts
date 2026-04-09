import { describe, expect, it } from "bun:test";
import { clampAttachedPanelWidth } from "./attached-panel.utils.ts";

describe("clampAttachedPanelWidth", () => {
  it("returns the current width when it is within bounds", () => {
    expect(clampAttachedPanelWidth(480, { min: 320, max: 640 })).toBe(480);
  });

  it("clamps widths below the minimum", () => {
    expect(clampAttachedPanelWidth(240, { min: 320, max: 640 })).toBe(320);
  });

  it("clamps widths above the maximum", () => {
    expect(clampAttachedPanelWidth(720, { min: 320, max: 640 })).toBe(640);
  });
});
