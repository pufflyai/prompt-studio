import { describe, expect, test } from "bun:test";
import { shouldShowFloatingToolbar } from "./should-show-floating-toolbar";

describe("shouldShowFloatingToolbar", () => {
  test("returns false for collapsed selections", () => {
    expect(
      shouldShowFloatingToolbar({
        hasSelection: true,
        isRangeSelection: true,
        isCollapsed: true,
        hasNativeSelection: true,
        hasNativeRange: true,
        isAnchorInsideEditor: true,
        isEditorEditable: true,
      }),
    ).toBe(false);
  });

  test("returns true for non-collapsed range selection in editable editor", () => {
    expect(
      shouldShowFloatingToolbar({
        hasSelection: true,
        isRangeSelection: true,
        isCollapsed: false,
        hasNativeSelection: true,
        hasNativeRange: true,
        isAnchorInsideEditor: true,
        isEditorEditable: true,
      }),
    ).toBe(true);
  });
});
