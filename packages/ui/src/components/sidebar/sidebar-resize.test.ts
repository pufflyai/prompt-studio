import { describe, expect, it } from "bun:test";
import { resolveSidebarResize } from "./sidebar-resize";

describe("resolveSidebarResize", () => {
  it("collapses when resized below the minimum width", () => {
    const result = resolveSidebarResize({ nextWidth: 199, minWidth: 200, maxWidth: 480, canCollapse: true });

    expect(result).toEqual({ type: "collapse" });
  });

  it("resizes when staying above the minimum width", () => {
    const result = resolveSidebarResize({ nextWidth: 220, minWidth: 200, maxWidth: 480, canCollapse: true });

    expect(result).toEqual({ type: "resize", width: 220 });
  });

  it("resizes at the exact minimum width", () => {
    const result = resolveSidebarResize({ nextWidth: 200, minWidth: 200, maxWidth: 480, canCollapse: true });

    expect(result).toEqual({ type: "resize", width: 200 });
  });

  it("keeps non-closable sidebars open below the minimum width", () => {
    const result = resolveSidebarResize({ nextWidth: 199, minWidth: 200, maxWidth: 480, canCollapse: false });

    expect(result).toEqual({ type: "resize", width: 200 });
  });
});
