import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("a closed declared tool reopens directly in the selected permitted panel", async () => {
  const core = createWorkbench();
  const page = { kind: "page" as const, extensionId: "test", id: "home" };
  core.modes.registerMode({
    id: "mode",
    regionSettings: { side: { acceptsTabs: false } },
    activate() {},
  });
  core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  core.pages.registerPage({
    id: "home",
    ref: page,
    path: "home",
    modeId: "mode",
    main: { kind: "panels", empty: { kind: "view", id: "view" } },
    slots: [],
  });
  core.modePlacements.registerPlacement({
    id: "tool",
    ref: { kind: "placement", extensionId: "test", id: "tool" },
    modeId: "mode",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "view" }, presence: "open" },
  });
  try {
    core.pageLocations.setProject("project");
    await core.navigation.openTarget({ kind: "page", page });
    const tool = core.layout.listPanelInstances("side")[0]!;
    core.movePanel(tool.instanceId, "main");
    const moved = core.layout.getLayout().regions.main.widgets.find((tab) => tab.widgetId === tool.instanceId)!;
    core.closePlacement(moved.placementIdentity!);
    const reopen = core.composition.panelsFor("main").addable.find((item) => item.panelId === tool.panelId)!;
    expect(reopen).toBeDefined();
    await reopen.open?.();
    expect(core.layout.listPanelInstances("main").filter((tab) => tab.panelId === tool.panelId)).toHaveLength(1);
    expect(core.layout.listPanelInstances("side")).toHaveLength(0);
  } finally {
    await core.dispose();
  }
});
