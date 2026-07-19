import { describe, expect, test } from "bun:test";
import { getResizableSplitAxis, resolveDraggedPanelSize } from "./resizable-split-layout.geometry";

describe("ResizableSplitLayout geometry", () => {
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

  test("closes a vertical panel at 72 px and keeps 73 px open at its configured minimum", () => {
    const input = {
      side: "bottom" as const,
      startSize: 240,
      minSize: 128,
      maxSize: 420,
      collapsible: true,
    };

    expect(resolveDraggedPanelSize({ ...input, pointerDelta: 168 })).toEqual({
      rawSize: 72,
      size: 0,
      collapsed: true,
    });
    expect(resolveDraggedPanelSize({ ...input, pointerDelta: 167 })).toEqual({
      rawSize: 73,
      size: 128,
      collapsed: false,
    });
  });

  test("preserves the existing horizontal collapse threshold", () => {
    const input = {
      side: "right" as const,
      startSize: 320,
      minSize: 320,
      maxSize: 520,
      collapsible: true,
    };

    expect(resolveDraggedPanelSize({ ...input, pointerDelta: 161 }).collapsed).toBe(true);
    expect(resolveDraggedPanelSize({ ...input, pointerDelta: 159 })).toEqual({
      rawSize: 161,
      size: 320,
      collapsed: false,
    });
  });
});
