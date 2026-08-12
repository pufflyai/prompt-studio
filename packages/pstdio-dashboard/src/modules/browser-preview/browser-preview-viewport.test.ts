import { describe, expect, test } from "bun:test";
import { normalizeBrowserPreviewViewport } from "./browser-preview-viewport";

describe("normalizeBrowserPreviewViewport", () => {
  test("defaults invalid values to responsive", () => {
    expect(normalizeBrowserPreviewViewport(undefined)).toEqual({ mode: "responsive" });
    expect(normalizeBrowserPreviewViewport({ mode: "tablet" })).toEqual({ mode: "responsive" });
  });

  test("keeps known viewport modes", () => {
    expect(normalizeBrowserPreviewViewport({ mode: "desktop" })).toEqual({ mode: "desktop" });
    expect(normalizeBrowserPreviewViewport({ mode: "mobile" })).toEqual({ mode: "mobile" });
  });

  test("clamps custom dimensions", () => {
    expect(normalizeBrowserPreviewViewport({ mode: "custom", width: 12, height: 9000 })).toEqual({
      mode: "custom",
      width: 320,
      height: 1600,
    });
  });
});
