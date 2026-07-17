import { describe, expect, test } from "bun:test";
import {
  redistributePaneSizes,
  resolveCollapseThreshold,
  resolvePaneBounds,
  resolveReservedPaneSize,
} from "./split-view.geometry";

describe("resolvePaneBounds", () => {
  test("uses the fallback size before the root is measured", () => {
    expect(
      resolvePaneBounds({
        rootSize: 0,
        minSizePx: 200,
        contentMinSizePx: 300,
      }),
    ).toEqual({ minSize: 200, maxSize: 900 });
  });

  test("caps the configured maximum to leave room for content", () => {
    expect(
      resolvePaneBounds({
        rootSize: 800,
        minSizePx: 200,
        maxSizePx: 700,
        contentMinSizePx: 260,
      }),
    ).toEqual({ minSize: 200, maxSize: 540 });
  });
});

describe("resolveReservedPaneSize", () => {
  test("reserves a sized pane's occupied size instead of only its minimum", () => {
    expect(resolveReservedPaneSize({ id: "inspector", sizePx: 400, minSizePx: 100 }, 400)).toBe(400);
  });
});

describe("resolveCollapseThreshold", () => {
  test("clamps the threshold between 72 and 160 pixels", () => {
    expect(resolveCollapseThreshold(80)).toBe(72);
    expect(resolveCollapseThreshold(240)).toBe(120);
    expect(resolveCollapseThreshold(480)).toBe(160);
  });
});

describe("redistributePaneSizes", () => {
  test("lets a spring pane absorb a sized pane resize", () => {
    expect(
      redistributePaneSizes({
        rootSize: 900,
        deltaPx: 300,
        before: { id: "navigation", sizePx: 240, minSizePx: 160, maxSizePx: 500 },
        after: { id: "content", minSizePx: 320 },
      }),
    ).toEqual([{ id: "navigation", sizePx: 500 }]);
  });

  test("redistributes between two sized panes within both panes' bounds", () => {
    expect(
      redistributePaneSizes({
        rootSize: 900,
        deltaPx: 180,
        before: { id: "left", sizePx: 300, minSizePx: 200, maxSizePx: 500 },
        after: { id: "right", sizePx: 300, minSizePx: 260, maxSizePx: 420 },
      }),
    ).toEqual([
      { id: "left", sizePx: 340 },
      { id: "right", sizePx: 260 },
    ]);
  });

  test("resizes a sized pane after a spring pane in the expected direction", () => {
    expect(
      redistributePaneSizes({
        rootSize: 900,
        deltaPx: 100,
        before: { id: "content", minSizePx: 400 },
        after: { id: "inspector", sizePx: 300, minSizePx: 180, maxSizePx: 360 },
      }),
    ).toEqual([{ id: "inspector", sizePx: 200 }]);
  });
});
