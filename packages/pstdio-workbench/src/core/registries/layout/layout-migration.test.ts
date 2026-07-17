import { describe, expect, test } from "bun:test";
import { classicFrame } from "./classic-frame";
import { defineFrame } from "./frame";
import { createLayoutModel } from "./layout-model";
import { createDefaultWorkbenchLayout, mergeWithDefaultAreas, type WorkbenchLayout } from "./layout-types";

const compactFrame = defineFrame({
  id: "compact",
  root: {
    kind: "split",
    id: "compact-root",
    direction: "row",
    children: [
      { kind: "slot", id: "left", owner: "project", role: "projection", reads: ["primary"] },
      { kind: "slot", id: "main", owner: "resource", role: "panels" },
    ],
  },
  primary: "main",
});

describe("mergeWithDefaultAreas", () => {
  test("quarantines absent slots and restores them when their frame returns", () => {
    const persisted = createDefaultWorkbenchLayout(classicFrame);
    const placement = { widgetId: "preview", contributionId: "preview" };
    persisted.areas["main-right"] = {
      id: "main-right",
      widgets: [placement],
      activeWidgetId: placement.widgetId,
    };
    persisted.activeSlotId = "main-right";

    const quarantined = mergeWithDefaultAreas(persisted, compactFrame);

    expect(quarantined.areas["main-right"]).toBeUndefined();
    expect(quarantined.orphans?.["main-right"]).toEqual(persisted.areas["main-right"]);
    expect(quarantined.activeSlotId).toBeUndefined();

    const restored = mergeWithDefaultAreas(quarantined, classicFrame);

    expect(restored.areas["main-right"]).toEqual(persisted.areas["main-right"]);
    expect(restored.orphans).toBeUndefined();
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
