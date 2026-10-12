import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench } from "../../core";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const metadata = {
  extensions: [],
  commands: [{ id: "test.command.create", extensionId: "test", title: "Create" }],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [],
  pages: [],
  views: [],
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  navigationItems: [],
  navigationTrees: [],
  statusBarItems: [],
  statuses: [],
  settingsPanels: [],
  diagnostics: [],
} satisfies WorkbenchExtensionMetadata;

for (const laterAction of ["close", "navigate"] as const) {
  test(`extension default navigation preserves the later ${laterAction} after its response arrives`, async () => {
    const core = createWorkbench();
    let finish = () => {};
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    core.modes.registerMode({
      id: "mode",
      regionSettings: { side: { defaultTab: { kind: "command", commandId: "test.command.create" } } },
      activate() {},
    });
    core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
    const panel = (id: string) => ({ kind: "placement" as const, extensionId: "test", id });
    for (const id of ["default", "explicit"])
      core.modePlacements.registerPlacement({
        id,
        ref: panel(id),
        modeId: "mode",
        region: "side",
        item: { kind: "view", view: { kind: "view", id: "view" }, presence: "closed" },
      });
    const page = { kind: "page" as const, extensionId: "test", id: "page" };
    core.pages.registerPage({
      id: "page",
      ref: page,
      path: "page",
      modeId: "mode",
      main: {
        kind: "view",
        view: { kind: "view", id: "view" },
        cardinality: "one",
      },
      slots: [],
    });
    core.registerModule({
      id: "test.extension",
      activate: (workbench) =>
        registerWorkbenchExtensionContributions({
          metadata,
          projectId: "project",
          workbench,
          executeCommand: async () => {
            await gate;
            return {
              outcome: {
                ok: true,
                status: "success",
                value: {},
                navigationRequests: [{ kind: "panel", panel: panel("default") }],
              },
            };
          },
        }),
    });
    core.pageLocations.setProject("project");
    await core.navigation.openTarget({ kind: "page", page });
    const opening = core.shell.setRegionOpen("side", true);
    core.shell.setRegionOpen("side", false);
    if (laterAction === "navigate") await core.navigation.openTarget({ kind: "panel", panel: panel("explicit") });
    finish();
    await opening;
    expect(core.layout.listPanelInstances("side")).toHaveLength(laterAction === "navigate" ? 2 : 1);
    expect(core.shell.getRegionState("side").open).toBe(laterAction === "navigate");
    await core.dispose();
  });
}
