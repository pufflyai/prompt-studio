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
    expect(resolveRegionPlacementRenderState(placement({ widgetId: "terminal" }), "active")).toEqual({
      active: false,
      display: "flex",
      pointerEvents: "none",
      position: "absolute",
      visibility: "hidden",
    });
  });

  test("renders the active placement in flow", () => {
    expect(resolveRegionPlacementRenderState(placement({ widgetId: "active" }), "active")).toEqual({
      active: true,
      display: "flex",
      pointerEvents: "auto",
      position: "relative",
      visibility: "visible",
    });
  });
});
