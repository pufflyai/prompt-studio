import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { modePanelFixture } from "../page-runtime/mode-panel-state.fixture";
import { createMemoryWorkbenchPageLocationBrowser } from "./page-location-memory";

const draftPanel = { kind: "placement", extensionId: "test", id: "drafts" } as const;
const registerDrafts = (fixture: ReturnType<typeof modePanelFixture>) =>
  fixture.w.modePlacements.registerPlacement({
    id: "drafts",
    ref: draftPanel,
    modeId: "alpha",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "document" }],
        cardinality: "many",
      },
    },
  });
const openDraft = (fixture: ReturnType<typeof modePanelFixture>) =>
  fixture.w.modePlacements.openPlacement({
    panel: draftPanel,
    resource: { type: "document", id: "unsent", projectId: "project" },
    open: "pin",
  });

const emptyBootFixture = (reject = false) => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  let writes = 0;
  const core = createWorkbench({
    pageLocationBrowser: {
      ...browser,
      replace(entry) {
        writes++;
        if (reject) throw new Error("History rejected");
        browser.replace(entry);
      },
    },
  });
  core.modes.registerMode({ id: "project", activate() {} });
  core.pageLocations.setProject("selected");
  core.modes.setActiveMode("project");
  return { core, browser, writes: () => writes };
};

test("booting an empty selected project commits its canonical root URL", () => {
  const { core, browser, writes } = emptyBootFixture();
  core.pageLocations.boot("selected");
  expect(browser.current()).toMatchObject({
    url: "/projects/selected",
  });
  expect(writes()).toBe(1);
  expect(core.pages.store.getState().location).toBeUndefined();
  expect(core.modes.getActiveModeId()).toBe("project");
  expect(core.pageLocations.historyStore.getState()).toEqual({ canGoBack: false, canGoForward: false });
});

test("a rejected empty-root replacement preserves the selected project's state and history", () => {
  const { core, browser, writes } = emptyBootFixture(true);
  const state = core.pages.store.getState();
  const entry = browser.current();
  const history = core.pageLocations.historyStore.getState();
  expect(core.pageLocations.boot("selected")).toMatchObject({
    ok: false,
    diagnostic: { message: "History rejected" },
  });
  expect(writes()).toBe(1);
  expect(browser.current()).toBe(entry);
  expect(core.pages.store.getState()).toBe(state);
  expect(core.pageLocations.historyStore.getState()).toEqual(history);
});

test("boot without the configured default restores the mode's shared panels", () => {
  const first = modePanelFixture(undefined, true, [], "");
  registerDrafts(first);
  first.w.modes.setActiveMode("alpha");
  first.w.pageLocations.navigateToRootLevel();
  expect(first.w.modes.getActiveModeId()).toBe("alpha");
  openDraft(first);
  first.w.shell.setRegionOpen("side", true);
  first.w.shell.setRegionSize("side", 480);
  const retained = first.w.layout.listPanelInstances("side")[0]!;

  const restored = modePanelFixture(first.saved, true, [], "");
  registerDrafts(restored);
  restored.w.modes.setActiveMode("alpha");
  restored.w.pageLocations.boot("project");

  expect(restored.w.pages.store.getState().location).toBeUndefined();
  expect(restored.w.modes.getActiveModeId()).toBe("alpha");
  expect(restored.ids("side")).toEqual(["unsent"]);
  expect(restored.w.layout.listPanelInstances("side")[0]?.instanceId).toBe(retained.instanceId);
  expect(restored.w.layout.getLayout().regions.side).toMatchObject({ visible: true, size: 480 });
});

test("an unavailable default restores only the selected project's shared panels", () => {
  const fixture = modePanelFixture(undefined, true, [], "");
  registerDrafts(fixture);
  fixture.w.modes.setActiveMode("alpha");
  fixture.w.pageLocations.navigateToRootLevel();
  openDraft(fixture);
  fixture.w.shell.setRegionOpen("side", true);

  fixture.w.pageLocations.switchProject("other");
  expect(fixture.w.pages.store.getState().projectId).toBe("other");
  expect(fixture.w.modes.getActiveModeId()).toBe("alpha");
  expect(fixture.ids("side")).toEqual([]);

  fixture.w.pageLocations.switchProject("project");
  expect(fixture.w.pages.store.getState().projectId).toBe("project");
  expect(fixture.ids("side")).toEqual(["unsent"]);
});

test("saved and available default destinations choose their own mode on project switches", () => {
  const defaultPage = { kind: "page", extensionId: "example.project", id: "landing" } as const;
  const fixture = modePanelFixture(undefined, true, [], "alpha", undefined, defaultPage);
  fixture.navigate("beta");
  fixture.w.pageLocations.switchProject("other");
  fixture.navigate("alpha");
  fixture.w.pageLocations.switchProject("project");
  expect(fixture.w.pages.store.getState().location?.page.id).toBe("beta");
  expect(fixture.w.modes.getActiveModeId()).toBe("beta");

  fixture.w.pages.registerPage({
    id: "start",
    ref: defaultPage,
    path: "start",
    modeId: "beta",
    main: { kind: "panels" },
    slots: [],
  });
  fixture.navigate("alpha");
  fixture.w.pageLocations.switchProject("new");
  expect(fixture.w.pages.store.getState().location?.page).toEqual(defaultPage);
  expect(fixture.w.modes.getActiveModeId()).toBe("beta");
});

test("a rejected boot browser commit does not fall back to an empty mode", () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  browser.replace({ url: "/projects/project/tool" });
  let writes = 0;
  const core = createWorkbench({
    pageLocationBrowser: {
      ...browser,
      replace() {
        writes++;
        throw new Error("History rejected");
      },
    },
  });
  core.modes.registerMode({ id: "project", activate() {} });
  core.pages.registerPage({
    id: "tool",
    ref: { kind: "page", extensionId: "pstdio", id: "tool" },
    path: "tool",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  core.pageLocations.setProject("project");
  core.modes.setActiveMode("project");
  const before = core.pages.store.getState();
  expect(core.pageLocations.boot("project")).toMatchObject({
    ok: false,
    diagnostic: { message: "History rejected" },
  });
  expect(writes).toBe(1);
  expect(core.pages.store.getState()).toBe(before);
});

test("Back and Forward restore ordinary tools and an unavailable default without losing the selected mode", () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const core = createWorkbench({ pageLocationBrowser: browser });
  core.modes.registerMode({ id: "project", activate() {} });
  for (const id of ["one", "two"]) {
    const ref = { kind: "page" as const, extensionId: "example", id };
    core.pages.registerPage({ id, ref, path: id, modeId: "project", main: { kind: "panels" }, slots: [] });
    core.navigationTrees.registerContribution({
      id,
      owner: ref,
      sourceExtensionId: "example",
      declarationIndex: 0,
      getSections: () => [],
    });
  }
  core.pageLocations.setProject("p1");
  core.modes.setActiveMode("project");
  core.pageLocations.boot("p1");
  for (const id of ["one", "two"])
    core.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "example", id } });
  core.pageLocations.navigateToRootLevel();
  expect(core.pages.store.getState().location).toBeUndefined();
  expect(browser.current().url).toBe("/projects/p1");
  core.pageLocations.goBack();
  expect(core.pages.store.getState().location?.page.id).toBe("two");
  core.pageLocations.goBack();
  expect(core.pages.store.getState().location?.page.id).toBe("one");
  core.pageLocations.goBack();
  expect(core.pages.store.getState().location).toBeUndefined();
  core.pageLocations.goForward();
  core.pageLocations.goForward();
  expect(core.pages.store.getState().location?.page.id).toBe("two");
  core.pageLocations.goForward();
  expect(core.pages.store.getState().location).toBeUndefined();
  expect(core.modes.getActiveModeId()).toBe("project");
});

test("history keeps an unavailable configured page empty and restores it after registration", () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const home = { kind: "page" as const, extensionId: "example", id: "home" };
  const tool = { ...home, id: "tool" };
  const core = createWorkbench({ defaultPage: home, pageLocationBrowser: browser });
  core.modes.registerMode({ id: "project", activate() {} });
  const register = (ref: typeof home) =>
    core.pages.registerPage({
      id: ref.id,
      ref,
      path: ref.id,
      modeId: "project",
      main: { kind: "panels" },
      slots: [],
    });
  const installed = register(home);
  register(tool);
  core.pageLocations.setProject("p1");
  core.pageLocations.boot("p1");
  core.pageLocations.navigate({ kind: "page", page: tool });
  installed.dispose();
  core.pageLocations.goBack();
  expect(core.pages.store.getState().location).toBeUndefined();
  expect(core.modes.getActiveModeId()).toBe("project");
  register(home);
  core.pageLocations.goForward();
  expect(core.pages.store.getState().location?.page).toEqual(tool);
  core.pageLocations.goBack();
  expect(core.pages.store.getState().location?.page).toEqual(home);
});

test("a native history entry from another project cannot clear the current tool when the default is unavailable", () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const home = { kind: "page" as const, extensionId: "example", id: "home" };
  const tool = { ...home, id: "tool" };
  const core = createWorkbench({ defaultPage: home, pageLocationBrowser: browser });
  core.modes.registerMode({ id: "project", activate() {} });
  const register = (ref: typeof home) =>
    core.pages.registerPage({
      id: ref.id,
      ref,
      path: ref.id,
      modeId: "project",
      main: { kind: "panels" },
      slots: [],
    });
  const installed = register(home);
  register(tool);
  core.pageLocations.setProject("other");
  core.pageLocations.boot("other");
  const foreignEntry = browser.current();
  core.pageLocations.setProject("current");
  core.pageLocations.boot("current");
  core.pageLocations.navigate({ kind: "page", page: tool });
  installed.dispose();
  const currentEntry = browser.current();
  const state = core.pages.store.getState();
  const history = core.pageLocations.historyStore.getState();
  browser.push(foreignEntry);
  browser.push(currentEntry);
  browser.back();
  expect(core.pages.store.getState()).toBe(state);
  expect(core.pageLocations.historyStore.getState()).toEqual(history);
});

test("malformed saved page data cannot crash replay of an unavailable default", () => {
  const { core, browser } = emptyBootFixture();
  core.pageLocations.boot("selected");
  const current = browser.current();
  browser.push({
    url: "/projects/selected",
    state: { kind: "pstdio.page-location", projectId: "selected", index: 1, routeKey: "invalid", location: {} },
  });
  browser.push(current);
  expect(() => browser.back()).not.toThrow();
  expect(core.pages.store.getState().location).toBeUndefined();
  expect(core.modes.getActiveModeId()).toBe("project");
});
