import { describe, expect, test } from "bun:test";
import { classicFrame } from "./classic-frame";
import { getTestArea } from "./layout-model-test-utils";
import { getActiveWidgetId, removePlacementsForContribution } from "./layout-operations";
import { createDefaultWorkbenchLayout } from "./layout-types";

describe("getActiveWidgetId", () => {
  test("derives the effective active placement from the active slot", () => {
    const layout = createDefaultWorkbenchLayout(classicFrame);
    getTestArea(layout, "main").widgets = [
      { widgetId: "settings", contributionId: "settings" },
      { widgetId: "settings:1", contributionId: "settings" },
    ];
    getTestArea(layout, "main").activeWidgetId = "settings:1";
    layout.activeSlotId = "main";

    expect(getActiveWidgetId(layout)).toBe("settings:1");

    getTestArea(layout, "main").activeWidgetId = undefined;
    expect(getActiveWidgetId(layout)).toBe("settings");

    layout.activeSlotId = undefined;
    expect(getActiveWidgetId(layout)).toBeUndefined();
  });

  test("needs no contribution-id repair after removing duplicated placements", () => {
    const layout = createDefaultWorkbenchLayout(classicFrame);
    getTestArea(layout, "main").widgets = [
      { widgetId: "settings", contributionId: "settings" },
      { widgetId: "settings:1", contributionId: "settings" },
    ];
    getTestArea(layout, "main").activeWidgetId = "settings:1";
    layout.activeSlotId = "main";

    const next = removePlacementsForContribution(layout, "settings");

    expect(getActiveWidgetId(next)).toBeUndefined();
    expect(next.activeSlotId).toBeUndefined();
  });
});
