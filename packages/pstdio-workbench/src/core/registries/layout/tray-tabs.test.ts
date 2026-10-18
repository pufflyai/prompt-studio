import { expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "./layout-types";
import { planTrayDrop } from "./tray-tabs";

const tab = (widgetId: string, preview = false) =>
  ({
    widgetId,
    contributionId: "document",
    role: "sub-panel",
    pinned: !preview,
    tabRetention: preview ? "preview" : "persistent",
  }) satisfies WorkbenchWidgetPlacement;

test("dropping an unpinned tab preserves the destination preview and inserts a pinned tab", () => {
  const preview = tab("preview", true);
  const pinned = tab("pinned");
  const incoming = tab("incoming", true);
  const result = planTrayDrop([preview, pinned], incoming, "end");
  expect(result.widgets.map((tab) => tab.widgetId)).toEqual(["preview", "pinned", "incoming"]);
  expect(result.widgets[0]).toBe(preview);
  expect(result.widgets[2]).toMatchObject({ pinned: true, tabRetention: "persistent" });
  expect(incoming.tabRetention).toBe("preview");
});

test("reordering an unpinned tab in the same tray pins it at the requested position", () => {
  const incoming = tab("incoming", true);
  const result = planTrayDrop([incoming, tab("pinned")], incoming, "end");
  expect(result.widgets.map((tab) => tab.widgetId)).toEqual(["pinned", "incoming"]);
  expect(result.widgets[1]).toMatchObject({ pinned: true, tabRetention: "persistent" });
});

test("dropping into an empty tray pins an unpinned tab", () => {
  expect(planTrayDrop([], tab("incoming", true)).widgets).toEqual([
    expect.objectContaining({ widgetId: "incoming", pinned: true, tabRetention: "persistent" }),
  ]);
});
