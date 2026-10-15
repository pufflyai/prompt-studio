import { describe, expect, test } from "bun:test";
import {
  getResizableSplitAxis,
  resolveDraggedPanelSize,
  resolveResizableBounds,
} from "./resizable-split-layout.geometry";

describe("ResizableSplitLayout geometry", () => {
  test("reserves the separator and minimum content width when sizing a panel", () => {
    expect(
      resolveResizableBounds({
        rootSize: 410,
        fallbackRootSize: 1200,
        separatorSize: 1,
        minSize: 144,
        contentMinSize: 265,
      }),
    ).toEqual({ minSize: 144, maxSize: 144 });
    expect(
      resolveResizableBounds({
        rootSize: 500,
        fallbackRootSize: 1200,
        separatorSize: 4,
        minSize: 144,
        contentMinSize: 120,
      }),
    ).toEqual({ minSize: 144, maxSize: 376 });
  });
  test("maps bottom panels to a vertical split with a horizontal separator", () => {
    expect(getResizableSplitAxis("bottom")).toEqual({
      rootDirection: "column",
      dimension: "height",
      separatorOrientation: "horizontal",
      cursor: "row-resize",
      pointerCoordinate: "clientY",
      deltaDirection: -1,
      panelFirst: false,
    });
  });

  for (const side of ["left", "right", "top", "bottom"] as const) {
    for (const minSize of [80, 128, 400]) {
      test(`${side} closes only below half its ${minSize}px minimum`, () => {
        const input = { side, startSize: 480, minSize, maxSize: 600, collapsible: true };
        const deltaDirection = getResizableSplitAxis(side).deltaDirection;
        const atSize = (size: number) =>
          resolveDraggedPanelSize({ ...input, pointerDelta: (size - input.startSize) * deltaDirection });

        expect(atSize(minSize / 2 - 1)).toEqual({ rawSize: minSize / 2 - 1, size: 0, collapsed: true });
        expect(atSize(minSize / 2)).toEqual({ rawSize: minSize / 2, size: minSize, collapsed: false });
      });
    }
    test(`${side} clamps a panel that cannot close`, () => {
      const result = resolveDraggedPanelSize({
        side,
        startSize: 240,
        pointerDelta: -480 * getResizableSplitAxis(side).deltaDirection,
        minSize: 80,
        maxSize: 420,
        collapsible: false,
      });
      expect(result).toEqual({ rawSize: -240, size: 80, collapsed: false });
    });
  }
});
