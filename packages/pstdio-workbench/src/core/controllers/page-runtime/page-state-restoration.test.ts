import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout } from "../../registries/layout/layout-types";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import { openResourceSlot, primarySlot } from "../../registries/pages/page-slot-lifecycle";
import { pageStateFromLayout } from "./page-state-restoration";

test("restores the selected primary instance after its presentation moves to Side", () => {
  const page: WorkbenchPageContribution = {
    id: "files",
    ref: { kind: "page", extensionId: "test", id: "files" },
    path: "files",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  };
  const layout = createDefaultWorkbenchLayout();
  layout.regions.side.widgets = ["one", "two"].map((id) => ({
    widgetId: id,
    contributionId: "files",
    role: "location",
    placementIdentity: { kind: "page", pageId: "files", slotId: "$main", instanceKey: id },
    resource: { type: "file", id },
    tabRetention: "persistent",
  }));
  layout.regions.side.activeWidgetId = "one";
  layout.activeLocationWidgetId = "one";
  expect(pageStateFromLayout(page, layout).activePrimaryInstanceKey).toBe("one");
});

test("restored single-resource pages keep their placement when selecting another resource", () => {
  const page: WorkbenchPageContribution = {
    id: "preview",
    ref: { kind: "page", extensionId: "test", id: "preview" },
    path: "preview",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "animation" }] },
    main: { kind: "view", view: { kind: "view", id: "preview" }, cardinality: "one" },
    slots: [],
  };
  const layout = createDefaultWorkbenchLayout();
  layout.regions.main.widgets = [
    {
      widgetId: "preview",
      contributionId: "preview",
      placementIdentity: { kind: "page", pageId: "preview", slotId: "$main", instanceKey: "first" },
      resource: { type: "animation", id: "first" },
    },
  ];
  layout.activeLocationWidgetId = "preview";
  const restored = pageStateFromLayout(page, layout);
  const next = openResourceSlot({
    slot: primarySlot(page)!,
    state: restored,
    target: { pageId: page.id, resource: { type: "animation", id: "next" } },
    resourceKey: (resource) => resource.id,
  });
  expect(next.activePrimaryInstanceKey).toBe(restored.activePrimaryInstanceKey);
});
