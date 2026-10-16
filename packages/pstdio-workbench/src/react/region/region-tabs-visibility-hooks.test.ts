import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchWidgetPlacement } from "../../core";
import { isPlacementEligibleForRegion } from "./region-tabs-visibility-hooks";

test.each(["side", "secondary"] as const)("%s tabs stay eligible after leaving their resource page", (region) => {
  const workbench = createWorkbench();
  workbench.layout.registerWidget({ id: "manual", region, rendererId: "manual", title: "Manual tab" });
  const placement: WorkbenchWidgetPlacement = {
    widgetId: "manual",
    contributionId: "manual",
    role: "sub-panel",
    ownerResourceKey: "workspace:source",
  };
  expect(isPlacementEligibleForRegion(workbench, region, placement)).toBe(true);
  expect(isPlacementEligibleForRegion(workbench, region, placement, { type: "ticket", id: "next" })).toBe(true);
  expect(isPlacementEligibleForRegion(workbench, "main", placement)).toBe(false);
});
