import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const registerLegacyTabLocks = (workbench: ReturnType<typeof createWorkbench>) => {
  const extensionId = "legacy";
  registerWorkbenchExtensionContributions({
    workbench,
    projectId: "project",
    executeCommand: () => undefined,
    metadata: {
      ...emptyWorkbenchExtensionMetadata,
      modes: [
        {
          id: "legacy.mode.main",
          extensionId,
          localId: "main",
          label: "Legacy",
          regions: ["main", "side", "secondary"],
        },
      ],
      views: [
        {
          id: "legacy.view.tool",
          extensionId,
          localId: "tool",
          title: "Legacy tool",
          body: { kind: "controls", queryHandlerId: "legacy.controls" },
        },
      ],
      pages: [
        {
          id: "legacy.page.home",
          extensionId,
          localId: "home",
          title: "Home",
          path: "home",
          mode: { kind: "mode", extensionId, id: "main" },
          main: { kind: "view", view: { kind: "view", extensionId, id: "tool" }, cardinality: "one" },
          slots: [],
        },
      ],
      placements: [
        {
          id: "legacy.placement.tool",
          extensionId,
          localId: "tool",
          mode: { kind: "mode", extensionId, id: "main" },
          region: "side",
          movableTo: ["side"],
          item: { kind: "view", view: { kind: "view", extensionId, id: "tool" }, presence: "fixed" },
        },
      ],
    },
  });
};

test("the extension host preserves fixed tabs, limited destinations, and fixed page Main", async () => {
  const core = createWorkbench();
  try {
    registerLegacyTabLocks(core);
    core.pageLocations.setProject("project");
    await core.navigation.openTarget({ kind: "page", page: { kind: "page", extensionId: "legacy", id: "home" } });
    for (const region of ["main", "side"] as const) {
      const tab = core.layout.getLayout().regions[region].widgets[0]!;
      expect(tab.closable).toBe(false);
      expect(() => core.closePlacement(tab.placementIdentity!)).toThrow("fixed");
    }
    const side = core.layout.getLayout().regions.side.widgets[0]!;
    expect(core.getPanelDestinations(side.widgetId)).toEqual(["side"]);
    expect(() => core.movePanel(side.widgetId, "secondary")).toThrow("cannot move");
  } finally {
    await core.dispose();
  }
});
