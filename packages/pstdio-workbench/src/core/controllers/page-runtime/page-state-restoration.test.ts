import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout } from "../../registries/layout/layout-types";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
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
