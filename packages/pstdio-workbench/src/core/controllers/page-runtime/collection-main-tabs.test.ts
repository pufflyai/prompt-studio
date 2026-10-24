import { expect, test } from "bun:test";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";

const pages = [
  {
    id: "collection",
    ref: pageRef("collection"),
    path: "collection",
    modeId: "alpha",
    main: { kind: "panels" },
    slots: [],
  },
  {
    id: "detail",
    ref: pageRef("detail"),
    path: "detail",
    modeId: "alpha",
    parentId: "collection",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
    slots: [],
  },
] as const;

for (const scoped of [true, false]) {
  test(`collection navigation restores resource tabs and tools, scoped=${scoped}`, () => {
    const s = modePanelFixture(undefined, scoped, [...pages], "collection");
    s.navigate("detail", "a");
    const resourceTab = s.w.layout.getActivePanel("main")!;
    s.open("tool", "main", "pin");
    const tool = s.w.layout.getActivePanel("main")!;
    s.navigate("alpha-list");
    s.navigate("collection");
    expect(s.ids("main")).toEqual(["a", "tool"]);
    expect(s.w.layout.getActivePanel("main")?.instanceId).toBe(tool.instanceId);
    s.navigate("detail", "b");
    expect(s.ids("main")).toEqual(["a", "tool", "b"]);
    s.navigate("alpha-list");
    s.navigate("collection");
    expect(s.ids("main")).toEqual(["a", "tool", "b"]);
    expect(s.w.layout.listPanelInstances("main")[0]?.instanceId).toBe(resourceTab.instanceId);
    const restored = modePanelFixture(s.saved, scoped, [...pages], "collection");
    expect(restored.ids("main")).toEqual(["a", "tool", "b"]);
    restored.w.closePlacement(restored.w.layout.listPanelInstances("main")[1]!.placementIdentity!);
    restored.navigate("alpha-list");
    restored.navigate("collection");
    expect(restored.ids("main")).toEqual(["a", "b"]);
  });
}

test("single-resource collection tabs use normal pin state and keep header choices per page", () => {
  const s = modePanelFixture(undefined, true, [...pages], "collection");
  s.navigate("detail", "a");
  const tab = s.w.layout.getActivePanel("main")!;
  expect(tab.tabRetention).toBe("persistent");
  s.w.pinPlacement(tab.placementIdentity!, false);
  expect(s.w.layout.getActivePanel("main")?.tabRetention).toBe("preview");
  s.w.pinPlacement(tab.placementIdentity!);
  s.w.shell.setHeaderVisible("main", false);
  s.navigate("collection");
  expect(s.ids("main")).toEqual(["a"]);
  expect(s.w.shell.getPanelPolicy("main").showHeader).toBe(true);
  s.navigate("detail", "a");
  expect(s.w.shell.getPanelPolicy("main").showHeader).toBe(false);
});

test.each([
  false,
  true,
])("existing detail caches migrate once and respect an empty collection cache, empty=%s", (empty) => {
  const s = modePanelFixture(undefined, true, [...pages], "collection");
  s.navigate("detail", "a");
  s.open("tool", "main", "pin");
  const layout = structuredClone(s.w.layout.getLayout());
  const newScope = 'workbench-collection-main:["project","alpha","collection","[null,null]"]';
  const oldScope = 'workbench-main:["project","alpha","detail","[\\"document:a\\",null]"]';
  s.saved.clear();
  s.saved.set(oldScope, layout);
  if (empty) {
    const blank = structuredClone(layout);
    blank.regions.main.widgets = [];
    blank.regions.main.activeWidgetId = undefined;
    s.saved.set(newScope, blank);
  }
  const restored = modePanelFixture(s.saved, true, [...pages], "collection");
  expect(restored.ids("main")).toEqual(empty ? [] : ["a", "tool"]);
  expect(s.saved.has(oldScope)).toBe(false);
  restored.navigate("alpha-list");
  restored.navigate("collection");
  expect(restored.ids("main")).toEqual(empty ? [] : ["a", "tool"]);
});

test("an unpinned static tab keeps its preview state after reload", () => {
  const s = modePanelFixture();
  const tab = s.w.layout.getActivePanel("main")!;
  s.w.pinPlacement(tab.placementIdentity!, false);
  const restored = modePanelFixture(s.saved);
  expect(restored.w.layout.getActivePanel("main")).toMatchObject({ tabRetention: "preview", pinned: false });
  restored.w.pinPlacement(restored.w.layout.getActivePanel("main")!.placementIdentity!);
  expect(restored.w.layout.getActivePanel("main")?.tabRetention).toBe("persistent");
});

test("closing the last detail tab stays closed when its route reloads", () => {
  const s = modePanelFixture(undefined, true, [...pages], "collection");
  s.navigate("detail", "a");
  s.w.closePlacement(s.w.layout.getActivePanel("main")!.placementIdentity!);
  const location = s.w.pages.store.getState().location!;
  const restored = modePanelFixture(s.saved, true, [...pages], "", { load: () => ({ location }), save() {} });
  restored.w.pageLocations.boot("project");
  expect(restored.ids("main")).toEqual([]);
});
