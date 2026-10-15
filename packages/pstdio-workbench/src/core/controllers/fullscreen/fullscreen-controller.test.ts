import { expect, test } from "bun:test";
import { createWindowingFixture } from "../../../examples/windowing/fixture";
import { windowingPages } from "../../../examples/windowing/resources";

for (const presentation of ["attached", "floating"] as const) {
  test(`${presentation} Side floats temporarily and overlay Close keeps saved intent`, async () => {
    const fixture = createWindowingFixture("windowing", { pagePanels: true });
    const core = fixture.workbench;
    await core.shell.setRegionOpen("side", true, presentation);
    const before = core.layout.getLayout();
    core.fullscreen.enter();
    expect(core.fullscreen.getSideMode()).toBe("floating");
    expect(core.layout.getLayout()).toBe(before);
    core.fullscreen.hideSide();
    core.fullscreen.exit();
    expect(core.sidePanel.getMode()).toBe("closed");
    expect(core.layout.getLayout().regions.side.presentation).toBe(presentation);
    await fixture.dispose();
  });
}

test("overlay Open retains attachment and keep-open intent after its default tab closes", async () => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true, floatingSessionDefault: true });
  const core = fixture.workbench;
  core.fullscreen.enter();
  await core.fullscreen.showSide();
  const tab = core.layout.getLayout().regions.side.widgets[0]!;
  core.closePlacement(tab.placementIdentity!);
  expect(core.shell.getPanelPolicy("side").open).toBe(true);
  core.fullscreen.exit();
  expect(core.sidePanel.getMode()).toBe("attached");
  expect(core.layout.getLayout().regions.side.widgets).toHaveLength(0);
  await fixture.dispose();
});

test("page navigation and history retain fullscreen; a non-expandable page exits and refuses entry", async () => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true });
  const core = fixture.workbench;
  core.pages.registerPage({
    ...core.pages.getPage("windowing.sessions")!,
    id: "windowing.compact",
    ref: { kind: "page", extensionId: "windowing", id: "compact" },
    path: "windowing/compact",
    expandable: false,
  });
  core.fullscreen.enter();
  core.pageLocations.navigate({ kind: "page", page: windowingPages.sessions });
  expect(core.fullscreen.store.getState().active).toBe(true);
  core.pageLocations.goBack();
  expect(core.fullscreen.store.getState().active).toBe(true);
  core.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "windowing", id: "compact" } });
  expect(core.fullscreen.store.getState().active).toBe(false);
  expect(core.fullscreen.enter()).toEqual({ ok: false, message: "This page cannot expand" });
  await fixture.dispose();
});

test("Secondary opens and attached edge drops exit fullscreen before revealing their destination", async () => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true });
  const core = fixture.workbench;
  core.fullscreen.enter();
  await core.shell.setRegionOpen("secondary", true);
  expect(core.fullscreen.store.getState().active).toBe(false);
  core.fullscreen.enter();
  const files = core.layout.getLayout().regions.main.widgets[0]!;
  core.dropPanelOnEdge(files.widgetId, "side");
  expect(core.fullscreen.store.getState().active).toBe(false);
  await fixture.dispose();
});

for (const regionSettings of [{ side: { floatable: false } }, { side: { canClose: false, canOpen: false } }]) {
  test(`fullscreen Side obeys ${JSON.stringify(regionSettings)}`, async () => {
    const fixture = createWindowingFixture("windowing", { pagePanels: true, regionSettings });
    const core = fixture.workbench;
    core.fullscreen.enter();
    expect(() => core.fullscreen.hideSide()).toThrow();
    if (regionSettings.side.floatable === false) {
      expect(core.fullscreen.getSideMode()).toBe("closed");
      expect(() => core.fullscreen.showSide()).toThrow();
    } else expect(core.fullscreen.getSideMode()).toBe("floating");
    await fixture.dispose();
  });
}

test("mode, project, reload and disposal clear temporary state", async () => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true });
  const core = fixture.workbench;
  core.modes.registerMode({ id: "other", label: "Other", activate() {} });
  core.fullscreen.enter();
  core.modes.setActiveMode("other");
  expect(core.fullscreen.store.getState().active).toBe(false);
  core.pageLocations.navigate({
    kind: "page",
    page: windowingPages.workspace,
    resource: fixture.resources.workspaces[0],
  });
  core.fullscreen.enter();
  core.pageLocations.setProject("other-project");
  expect(core.fullscreen.store.getState().active).toBe(false);
  core.pageLocations.switchProject("windowing-project");
  core.fullscreen.enter();
  await fixture.reload();
  expect(core.fullscreen.store.getState().active).toBe(false);
  expect(fixture.workbench.fullscreen.store.getState().active).toBe(false);
  fixture.workbench.fullscreen.enter();
  await fixture.dispose();
  expect(fixture.workbench.fullscreen.store.getState().active).toBe(false);
});

test("enter and exit expand Main without writing saved layout", async () => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true });
  const core = fixture.workbench;
  const before = core.layout.getLayout();
  expect(core.fullscreen.enter()).toEqual({ ok: true });
  expect(core.fullscreen.enter()).toEqual({ ok: true });
  expect(core.fullscreen.store.getState().active).toBe(true);
  expect(core.fullscreen.getSideMode()).toBe("closed");
  expect(core.layout.getLayout()).toBe(before);
  core.fullscreen.exit();
  core.fullscreen.exit();
  expect(core.fullscreen.store.getState().active).toBe(false);
  expect(core.layout.getLayout()).toBe(before);
  await fixture.dispose();
});

test("quiet session creation stays quiet and a fixed Timeline still forbids flipping Main", async () => {
  const fixture = createWindowingFixture("windowing", {
    pagePanels: true,
    regionSettings: { secondary: { movable: false } },
  });
  const core = fixture.workbench;
  core.fullscreen.enter();
  const before = core.layout.getLayout();
  fixture.startSession(fixture.resources.workspaces[0]!);
  expect(core.fullscreen.store.getState().active).toBe(true);
  expect(core.layout.getLayout()).toBe(before);
  expect(() => core.repositionPanel("main", "bottom")).toThrow("cannot move");
  expect(core.layout.getLayout()).toBe(before);
  await fixture.dispose();
});
