import { expect, test } from "bun:test";
import { createWindowingFixture } from "../../../examples/windowing/fixture";
import { windowingExtensionId, windowingPages } from "../../../examples/windowing/resources";
import { createWorkbench } from "../../workbench-core";

test("legacy extension tabs reveal an automatic panel after an empty snapshot", async () => {
  const core = createWorkbench();
  core.modes.registerMode({
    id: "legacy",
    panelHeaders: "legacy",
    panels: ["main", "secondary"],
    regionSettings: { secondary: { collapsible: false } },
    activate() {},
  });
  core.modes.setActiveMode("legacy");
  core.layout.registerPanel({
    id: "player",
    title: "Player",
    region: "secondary",
    rendererId: "player",
    singleton: true,
    closable: false,
  });
  core.layout.openWidget("player");
  const layout = core.layout.getLayout();
  core.layout.restoreLayout({
    ...layout,
    regions: { ...layout.regions, secondary: { ...layout.regions.secondary, visible: false, visibility: undefined } },
  });
  expect(core.shell.getRegionState("secondary").open).toBe(true);
  await core.shell.setRegionOpen("secondary", false);
  expect(core.shell.getRegionState("secondary").open).toBe(false);
  await core.shell.setRegionOpen("secondary", true);
  expect(core.shell.getRegionState("secondary").open).toBe(true);
  await core.dispose();
});

test("panel commands reject disallowed visibility and resizing without changing state", () => {
  const core = createWorkbench({ initialSidePanelMode: "attached" });
  core.modes.registerMode({
    id: "fixed",
    panels: ["main", "side"],
    regionSettings: { side: { canOpen: false, canClose: false, resizable: false } },
    activate() {},
  });
  core.modes.setActiveMode("fixed");
  const before = core.layout.getLayout();
  expect(() => core.shell.setRegionOpen("side", false)).toThrow("cannot close");
  expect(() => core.shell.setRegionOpen("secondary", true)).toThrow("not provided");
  expect(() => core.shell.setRegionSize("side", 320)).toThrow("cannot resize");
  expect(core.layout.getLayout()).toBe(before);
});

test("restore discards tabs and intent for panels the active mode no longer provides", () => {
  const core = createWorkbench();
  core.modes.registerMode({ id: "main-only", panels: ["main"], activate() {} });
  core.modes.setActiveMode("main-only");
  const layout = core.layout.getLayout();
  core.layout.restoreLayout({
    ...layout,
    activeWidgetId: "removed",
    regions: {
      ...layout.regions,
      side: {
        ...layout.regions.side,
        visible: true,
        visibility: "open",
        activeWidgetId: "removed",
        widgets: [{ widgetId: "removed", contributionId: "gone" }],
      },
    },
  });
  expect(core.layout.getLayout().regions.side.widgets).toEqual([]);
  expect(core.shell.getRegionState("side").open).toBe(false);
  expect(core.layout.getLayout().activeWidgetId).toBeUndefined();
});

test("default tabs run once on direct empty open, never on reveal, drop, or restore", async () => {
  const core = createWorkbench({ initialSidePanelMode: "attached" });
  let created = 0;
  core.layout.registerPanel({
    id: "default",
    title: "Default",
    region: "secondary",
    rendererId: "default",
    singleton: false,
    closable: true,
  });
  core.commands.registerCommand(
    { id: "example.command.default", label: "Create default" },
    {
      execute: () => {
        created++;
        core.layout.openPanel("default");
      },
    },
  );
  core.modes.registerMode({
    id: "tools",
    regionSettings: { secondary: { defaultTab: { kind: "command", commandId: "example.command.default" } } },
    activate() {},
  });
  core.modes.setActiveMode("tools");
  core.shell.revealRegion("secondary");
  core.layout.restoreLayout(core.layout.getLayout());
  expect(created).toBe(0);
  await Promise.all([core.shell.setRegionOpen("secondary", true), core.shell.setRegionOpen("secondary", true)]);
  expect(created).toBe(1);
  core.layout.closePanel(core.layout.listPanelInstances("secondary")[0]!.instanceId);
  expect(core.shell.getRegionState("secondary").open).toBe(true);
  expect(created).toBe(1);
});

test("pending default creation is shared by the mode owner across pages", async () => {
  const fixture = createWindowingFixture("windowing", {
    pagePanels: true,
    regionSettings: { side: { defaultTab: { kind: "command", commandId: "create-default" } } },
  });
  const core = fixture.workbench;
  let created = 0;
  let finish = () => {};
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  core.commands.registerCommand(
    { id: "create-default", label: "Create default" },
    {
      execute: async () => {
        created++;
        await gate;
      },
    },
  );
  const first = core.shell.setRegionOpen("side", true);
  core.pageLocations.navigate({
    kind: "page",
    page: windowingPages.workspace,
    resource: fixture.resources.workspaces[1],
  });
  const second = core.shell.setRegionOpen("side", true);
  expect(created).toBe(1);
  finish();
  await Promise.all([first, second]);
  await fixture.dispose();
});

test("a panel that refuses incoming tabs rejects drops and opens its declared tool", async () => {
  const fixture = createWindowingFixture("windowing", {
    pagePanels: true,
    regionSettings: { side: { acceptsTabs: false } },
  });
  const core = fixture.workbench;
  const before = core.layout.getLayout();
  const tab = core.layout.listPanelInstances("bottom")[0]!;
  expect(() => core.movePanel(tab.instanceId, "side")).toThrow("cannot move");
  expect(core.layout.getLayout()).toBe(before);
  await core.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
    resource: fixture.resources.sessions[0],
  });
  const sessions = core.layout.listPanelInstances("side");
  expect(sessions).toHaveLength(1);
  expect(sessions[0]!.resource).toEqual(fixture.resources.sessions[0]);
  expect(core.layout.getLayout().activeWidgetId).toBe(sessions[0]!.instanceId);
  await fixture.dispose();
});

test("opening a moved tab validates its actual destination before selection or reveal", async () => {
  const fixture = createWindowingFixture("windowing", {
    pagePanels: true,
    regionSettings: { side: { acceptsTabs: false }, secondary: { canOpen: false, canClose: true } },
  });
  const core = fixture.workbench;
  const panel = { kind: "placement", extensionId: windowingExtensionId, id: "preset" } as const;
  core.modePlacements.registerPlacement({
    id: "preset",
    ref: panel,
    modeId: "windowing",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "windowing.session" }, presence: "open" },
  });
  const tab = core.layout.listPanelInstances("side").find((tab) => tab.panelId.endsWith("preset"))!;
  core.movePanel(tab.instanceId, "secondary");
  await core.navigation.openTarget({ kind: "panel", panel });
  expect(core.layout.getLayout().activeWidgetId).toBe(tab.instanceId);
  core.shell.setRegionOpen("secondary", false);
  const before = core.layout.getLayout();
  await expect(core.navigation.openTarget({ kind: "panel", panel })).rejects.toThrow("cannot open: secondary");
  expect(core.layout.getLayout()).toBe(before);
  await fixture.dispose();
});

test("explicitly opening an empty panel keeps its drop surface until explicitly closed", () => {
  const core = createWorkbench({ initialSidePanelMode: "attached" });
  core.modes.registerMode({ id: "tools", activate() {} });
  core.modes.setActiveMode("tools");
  expect(core.shell.getRegionState("secondary").open).toBe(false);
  core.shell.setRegionOpen("secondary", true);
  expect(core.shell.getRegionState("secondary").open).toBe(true);
  expect(core.layout.getLayout().regions.secondary.visibility).toBe("open");
  core.shell.setRegionOpen("secondary", false);
  expect(core.shell.getRegionState("secondary").open).toBe(false);
});

test("page bottom intent stays with its resource and mode intent survives navigation and reload", async () => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true });
  let core = fixture.workbench;
  await core.shell.setRegionOpen("bottom", true);
  core.shell.setHeaderVisible("bottom", false);
  await core.shell.setRegionOpen("secondary", true);
  core.shell.setHeaderVisible("secondary", false);
  core.pageLocations.navigate({
    kind: "page",
    page: windowingPages.workspace,
    resource: fixture.resources.workspaces[1],
  });
  expect(core.layout.getLayout().regions.bottom.visibility).toBeUndefined();
  expect(core.layout.getLayout().regions.bottom.headerVisible).toBeUndefined();
  expect(core.layout.getLayout().regions.secondary.visibility).toBe("open");
  expect(core.shell.getPanelPolicy("secondary").showHeader).toBe(false);
  core = await fixture.reload();
  expect(core.layout.getLayout().regions.secondary.visibility).toBe("open");
  expect(core.shell.getPanelPolicy("secondary").showHeader).toBe(false);
  core.pageLocations.navigate({
    kind: "page",
    page: windowingPages.workspace,
    resource: fixture.resources.workspaces[0],
  });
  expect(core.layout.getLayout().regions.bottom.visibility).toBe("open");
  expect(core.shell.getPanelPolicy("bottom").showHeader).toBe(false);
  await fixture.dispose();
});

for (const initialSidePanelMode of [undefined, "closed"] as const) {
  test(`revealing the first Side tab preserves default floating with initial mode ${initialSidePanelMode}`, async () => {
    const core = createWorkbench({ initialSidePanelMode });
    core.modes.registerMode({ id: "mode", panels: ["main", "side"], activate() {} });
    core.modes.setActiveMode("mode");
    core.layout.registerPanel({ id: "view", title: "View", region: "main", rendererId: "view", closable: true });
    core.layout.openPanel("view");
    expect(core.sidePanel.getMode()).toBe("closed");
    const tab = core.layout.listPanelInstances("main")[0]!;
    core.movePanel(tab.instanceId, "side");
    expect(core.sidePanel.getMode()).toBe("floating");
    expect(core.layout.getLayout().regions.side.visibility).toBeUndefined();
    core.shell.setRegionOpen("side", false);
    core.shell.revealRegion("side");
    expect(core.sidePanel.getMode()).toBe("attached");
    await core.dispose();
  });
}
