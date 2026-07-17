import { describe, expect, test } from "bun:test";
import { applyFrameToLayout } from "./apply-frame";
import { classicFrame } from "./classic-frame";
import { defineFrame } from "./frame";
import { createDefaultWorkbenchLayout } from "./layout-types";

const focusFrame = defineFrame({
  id: "focus",
  root: {
    kind: "split",
    id: "focus-root",
    direction: "row",
    children: [
      classicFrame.slots.activity,
      classicFrame.slots.main,
      classicFrame.slots.side,
      classicFrame.slots.status,
    ],
  },
  primary: "main",
  attached: { slot: "side", persistence: "detached", candidates: "scoped" },
});

describe("applyFrameToLayout", () => {
  test("quarantines absent slots and restores their complete area state", () => {
    const layout = createDefaultWorkbenchLayout(classicFrame);
    const first = { widgetId: "project.tree", contributionId: "project.tree" };
    const second = { widgetId: "project.outline", contributionId: "project.outline" };
    layout.areas.left = { id: "left", widgets: [first, second], activeWidgetId: second.widgetId };
    layout.nodes.left = { size: 312, collapsed: true };
    layout.activeSlotId = "left";
    layout.activeResourceUri = "pstdio://project/one";
    layout.orphans = {
      legacy: { id: "legacy", widgets: [{ widgetId: "legacy", contributionId: "legacy" }] },
    };
    const main = layout.areas.main;

    const focused = applyFrameToLayout(layout, focusFrame);

    expect(focused.areas.left).toBeUndefined();
    expect(focused.orphans?.left).toEqual(layout.areas.left);
    expect(focused.orphans?.legacy).toEqual(layout.orphans.legacy);
    expect(focused.areas.main).toBe(main);
    expect(focused.nodes.left).toEqual({ size: 312, collapsed: true });
    expect(focused.activeSlotId).toBeUndefined();
    expect(focused.activeResourceUri).toBeUndefined();
    expect(applyFrameToLayout(focused, focusFrame)).toEqual(focused);

    const restored = applyFrameToLayout(focused, classicFrame);

    expect(restored.areas.left).toEqual(layout.areas.left);
    expect(restored.areas.left?.widgets).toEqual([first, second]);
    expect(restored.areas.left?.activeWidgetId).toBe(second.widgetId);
    expect(restored.nodes.left).toEqual({ size: 312, collapsed: true });
    expect(restored.orphans?.left).toBeUndefined();
    expect(restored.orphans?.legacy).toEqual(layout.orphans.legacy);
  });
});
