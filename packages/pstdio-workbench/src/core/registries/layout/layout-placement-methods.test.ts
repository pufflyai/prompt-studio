import { expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";

test("unpinning an inactive raw panel replaces the active preview and selects the remaining panel", () => {
  const layout = createLayoutModel();
  layout.registerPanel({
    id: "editor",
    title: "Editor",
    region: "secondary",
    rendererId: "editor",
    reuse: "none",
    singleton: false,
  });
  const preview = layout.openWidget("editor", {
    resource: { type: "file", id: "old" },
    role: "sub-panel",
    tabRetention: "preview",
  });
  const pinned = layout.openWidget("editor", {
    resource: { type: "file", id: "pinned" },
    role: "sub-panel",
    tabRetention: "persistent",
    pinned: true,
  });
  layout.activatePanel(preview.widgetId);
  layout.updatePanel(pinned.widgetId, { strategy: { kind: "preview" } });
  expect(layout.listPanelInstances("secondary").map((panel) => panel.resource?.id)).toEqual(["pinned"]);
  expect(layout.getActivePanel()?.instanceId).toBe(pinned.widgetId);
  expect(layout.getLayout().regions.secondary.activeWidgetId).toBe(pinned.widgetId);
});
