import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const panel = (id: string) => ({ kind: "placement" as const, extensionId: "test", id });
const pendingDefault = async () => {
  const core = createWorkbench({ initialSidePanelMode: "closed" });
  let finish = () => {};
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  core.commands.registerCommand(
    { id: "create", label: "Create" },
    {
      execute: async (_args, context) => {
        await gate;
        await context!.navigation!.openTarget({ kind: "panel", panel: panel("default") });
      },
    },
  );
  core.modes.registerMode({
    id: "mode",
    regionSettings: { side: { defaultTab: { kind: "command", commandId: "create" } } },
    activate() {},
  });
  core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
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
    main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
    slots: [],
  });
  core.pageLocations.setProject("project");
  await core.navigation.openTarget({ kind: "page", page });
  const opening = core.shell.setRegionOpen("side", true);
  core.shell.setRegionOpen("side", false);
  return { core, finish, opening };
};

test("a later explicit navigation reveals Side while an older default is pending", async () => {
  const { core, finish, opening } = await pendingDefault();
  try {
    await core.navigation.openTarget({ kind: "panel", panel: panel("explicit") });
    const during = core.shell.getRegionState("side").open;
    finish();
    await opening;
    const after = core.shell.getRegionState("side").open;
    expect(during).toBe(true);
    expect(after).toBe(true);
  } finally {
    finish();
    await opening;
    await core.dispose();
  }
});

test("a later explicit drop reveals Side while an older default is pending", async () => {
  const { core, finish, opening } = await pendingDefault();
  try {
    const tab = core.layout.listPanelInstances("main")[0]!;
    expect(core.getPanelDestinations(tab.instanceId)).toContain("side");
    core.movePanel(tab.instanceId, "side");
    const during = core.shell.getRegionState("side").open;
    finish();
    await opening;
    const after = core.shell.getRegionState("side").open;
    expect(during).toBe(true);
    expect(after).toBe(true);
  } finally {
    finish();
    await opening;
    await core.dispose();
  }
});

for (const action of ["navigation", "drop"] as const) {
  test(`normal ${action} during default publication has its own reveal scope`, async () => {
    const { core, finish, opening } = await pendingDefault();
    let requested = false;
    let navigation: Promise<readonly unknown[]> | undefined;
    const unsubscribe = core.layout.store.subscribe(() => {
      if (requested || !core.layout.listPanelInstances("side").some((tab) => tab.panelId.endsWith(".default"))) return;
      requested = true;
      if (action === "navigation") navigation = core.navigation.openTarget({ kind: "panel", panel: panel("explicit") });
      else core.movePanel(core.layout.listPanelInstances("main")[0]!.instanceId, "side");
    });
    try {
      finish();
      await opening;
      await navigation;
      expect(requested).toBe(true);
      expect(core.shell.getRegionState("side").open).toBe(true);
      expect(core.layout.getLayout().regions.side.visibility).toBe("auto");
    } finally {
      unsubscribe();
      await core.dispose();
    }
  });

  test(`explicit ${action} reveals a closed Side after default creation has finished`, async () => {
    const { core, finish, opening } = await pendingDefault();
    try {
      finish();
      await opening;
      expect(core.shell.getRegionState("side").open).toBe(false);
      if (action === "navigation") await core.navigation.openTarget({ kind: "panel", panel: panel("explicit") });
      else core.movePanel(core.layout.listPanelInstances("main")[0]!.instanceId, "side");
      expect(core.shell.getRegionState("side").open).toBe(true);
    } finally {
      await core.dispose();
    }
  });
}
