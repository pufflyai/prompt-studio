import { describe, expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../core";
import { resolveRegionPlacementRenderState } from "./region";

const placement = (overrides: Partial<WorkbenchWidgetPlacement>): WorkbenchWidgetPlacement => ({
  widgetId: overrides.widgetId ?? "widget",
  contributionId: overrides.contributionId ?? "contribution",
  ...overrides,
});

describe("resolveRegionPlacementRenderState", () => {
  test("keeps inactive keep-mounted placements measurable", () => {
    expect(resolveRegionPlacementRenderState(placement({ widgetId: "terminal" }), "active", "main")).toEqual({
      active: false,
      display: "flex",
      pointerEvents: "none",
      position: "absolute",
      visibility: "hidden",
    });
  });

  test("renders the active placement in flow", () => {
    expect(resolveRegionPlacementRenderState(placement({ widgetId: "active" }), "active", "main")).toEqual({
      active: true,
      display: "flex",
      pointerEvents: "auto",
      position: "relative",
      visibility: "visible",
    });
  });

  test("keeps inactive Sidenav sections visible and interactive", () => {
    expect(
      resolveRegionPlacementRenderState(placement({ widgetId: "mode-sessions" }), "page-tools", "sidenav"),
    ).toEqual({
      active: false,
      display: "flex",
      pointerEvents: "auto",
      position: "relative",
      visibility: "visible",
    });
  });
});
