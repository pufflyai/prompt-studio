import { describe, expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../core";
import { filterSidePanelPlacements } from "./side-panel-placements";

const placement = (widgetId: string, companionOfPrimary = false): WorkbenchWidgetPlacement => ({
  widgetId,
  contributionId: widgetId,
  title: widgetId,
  companionOfPrimary,
});

describe("filterSidePanelPlacements", () => {
  test("keeps global panels visible without a primary resource", () => {
    expect(filterSidePanelPlacements([placement("global"), placement("companion", true)], false)).toEqual([
      placement("global"),
    ]);
  });

  test("includes primary companions while a primary resource is active", () => {
    const placements = [placement("global"), placement("companion", true)];

    expect(filterSidePanelPlacements(placements, true)).toEqual(placements);
  });
});
