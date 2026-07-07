import { describe, expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../core";
import { resolveAreaPlacementRenderState } from "./area";

const placement = (overrides: Partial<WorkbenchWidgetPlacement>): WorkbenchWidgetPlacement => ({
  widgetId: overrides.widgetId ?? "widget",
  contributionId: overrides.contributionId ?? "contribution",
  ...overrides,
});

describe("resolveAreaPlacementRenderState", () => {
  test("keeps inactive keep-mounted placements measurable", () => {
    expect(resolveAreaPlacementRenderState(placement({ widgetId: "terminal" }), "active")).toEqual({
      active: false,
      display: "flex",
      pointerEvents: "none",
      position: "absolute",
      visibility: "hidden",
    });
  });

  test("renders the active placement in flow", () => {
    expect(resolveAreaPlacementRenderState(placement({ widgetId: "active" }), "active")).toEqual({
      active: true,
      display: "flex",
      pointerEvents: "auto",
      position: "relative",
      visibility: "visible",
    });
  });
});
