import { describe, expect, test } from "bun:test";
import { classicFrame } from "./classic-frame";
import { createLayoutModel } from "./layout-model";
import { createDefaultWorkbenchLayout, mergeWithDefaultAreas, type WorkbenchLayout } from "./layout-types";

describe("mergeWithDefaultAreas", () => {
  test("quarantines every legacy side-panel slot without dropping its widgets", () => {
    const persisted = createDefaultWorkbenchLayout(classicFrame);
    const legacySlotIds = ["main-right", "floating-header", "floating"];
    for (const id of legacySlotIds) {
      const placement = { widgetId: `${id}.preview`, contributionId: `${id}.preview` };
      persisted.areas[id] = { id, widgets: [placement], activeWidgetId: placement.widgetId };
    }
    persisted.activeSlotId = "main-right";

    const quarantined = mergeWithDefaultAreas(persisted, classicFrame);

    for (const id of legacySlotIds) {
      expect(quarantined.areas[id]).toBeUndefined();
      expect(quarantined.orphans?.[id]).toEqual(persisted.areas[id]);
    }
    expect(quarantined.activeSlotId).toBeUndefined();
  });

  test("discards an unreadable pre-normalisation layout", () => {
    const oldLayout = {
      areas: { main: { id: "main", visible: true, widgets: [] } },
    } as unknown as WorkbenchLayout;
    const persistence = {
      getLayout: () => oldLayout,
      setLayout: () => undefined,
    };

    const layout = createLayoutModel({ persistence });

    expect(Object.keys(layout.getLayout().areas).sort()).toEqual(Object.keys(classicFrame.slots).sort());
    expect(layout.getLayout().nodes).toEqual({});
  });
});
