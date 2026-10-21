import { expect, test } from "bun:test";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";

for (const scoped of [true, false]) {
  for (const region of ["side", "secondary"] as const) {
    test(`a page moved into ${region} stays across pages, modes and restart; scoped=${scoped}`, () => {
      const s = modePanelFixture(undefined, scoped);
      const original = s.w.layout.getActivePanel("main")!;
      s.w.movePanel(original.instanceId, region);
      s.navigate("alpha-list");
      expect(s.w.layout.listPanelInstances(region).map((tab) => tab.instanceId)).toEqual([original.instanceId]);
      expect(s.w.shell.getRegionState(region).open).toBe(true);
      s.navigate("alpha");
      expect(s.w.layout.listPanelInstances("main").map((tab) => tab.instanceId)).not.toContain(original.instanceId);
      expect(s.w.layout.listPanelInstances(region).map((tab) => tab.instanceId)).toEqual([original.instanceId]);
      s.navigate("bare");
      expect(s.w.layout.listPanelInstances(region)).toEqual([]);
      s.navigate("alpha-list");
      expect(s.w.layout.listPanelInstances(region).map((tab) => tab.instanceId)).toEqual([original.instanceId]);
      const restored = modePanelFixture(s.saved, scoped);
      restored.navigate("alpha-list");
      expect(restored.w.layout.listPanelInstances(region).map((tab) => tab.instanceId)).toEqual([original.instanceId]);
    });

    test(`a resource moved into ${region} stays when another resource and page open; scoped=${scoped}`, () => {
      const s = modePanelFixture(undefined, scoped);
      s.navigate("document", "a");
      const original = s.w.layout.getActivePanel("main")!;
      s.w.movePanel(original.instanceId, region);
      s.navigate("document", "b");
      expect(s.ids(region)).toEqual(["a"]);
      s.navigate("alpha-list");
      expect(s.ids(region)).toEqual(["a"]);
      s.w.closePlacement(original.placementIdentity!);
      expect(s.ids(region)).toEqual([]);
      expect(s.w.pages.store.getState().activePageId).toBe("alpha-list");
      expect(s.w.shell.getRegionState(region).open).toBe(false);
      s.navigate("alpha");
      expect(s.ids(region)).toEqual([]);
    });
  }
}

test("a single-resource page selects another resource in its chosen Side region", () => {
  const s = modePanelFixture();
  s.w.pages.registerPage({
    id: "single",
    ref: pageRef("single"),
    path: "single",
    modeId: "alpha",
    parentId: "alpha",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
    slots: [],
  });
  s.navigate("single", "a");
  const original = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(original.instanceId, "side");
  s.navigate("single", "b");
  expect(s.ids("side")).toEqual(["b"]);
  expect(s.ids("main")).toEqual([]);
  expect(s.w.getPrimaryResource()?.id).toBe("b");
});

test("a shared page resource survives another owner's refresh and can be unpinned and replaced", () => {
  const s = modePanelFixture();
  s.navigate("document", "a");
  const original = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(original.instanceId, "side");
  s.navigate("alpha-list");
  s.open("other", "secondary", "pin");
  expect(s.ids("side")).toEqual(["a"]);
  s.w.pinPlacement(original.placementIdentity!, false);
  expect(s.w.layout.listPanelInstances("side")[0]?.tabRetention).toBe("preview");
  s.open("replacement", "side");
  expect(s.ids("side")).toEqual(["replacement"]);
  s.navigate("alpha");
  expect(s.ids("side")).toEqual([]);
  s.navigate("alpha-list");
  expect(s.ids("side")).toEqual([]);
});

test("moving a page-created shared tab into another page's Main keeps it local to that page", () => {
  const s = modePanelFixture();
  s.navigate("document", "a");
  const original = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(original.instanceId, "side");
  s.navigate("alpha-list");
  s.w.movePanel(original.instanceId, "main");
  s.open("other", "secondary", "pin");
  expect(s.ids("main")).toContain("a");
  s.navigate("alpha");
  expect(s.ids("main")).not.toContain("a");
  s.navigate("alpha-list");
  expect(s.ids("main")).toContain("a");
  s.w.closePlacement(original.placementIdentity!);
  expect(s.ids("main")).not.toContain("a");
  expect(s.w.pages.store.getState().activePageId).toBe("alpha-list");
});

test("a shared page tab follows resource metadata after leaving its creator page", () => {
  const s = modePanelFixture();
  s.navigate("document", "a");
  const original = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(original.instanceId, "side");
  s.navigate("alpha-list");
  s.w.pages.refreshResource({ type: "document", id: "a", label: "Renamed", metadata: { value: "updated" } });
  expect(s.w.layout.getLayout().regions.side.widgets[0]).toMatchObject({
    title: "Renamed",
    pinned: true,
    tabRetention: "persistent",
    resource: { id: "a", label: "Renamed", metadata: { value: "updated" } },
  });
  expect(s.w.pages.store.getState().activePageId).toBe("alpha-list");
});

test.each([true, false])("removing a page owner removes its suspended shared tabs; scoped=%s", (scoped) => {
  const s = modePanelFixture(undefined, scoped);
  const registration = s.w.pages.registerPage({
    id: "owned",
    ref: pageRef("owned"),
    path: "owned",
    modeId: "alpha",
    parentId: "alpha",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "many" },
    slots: [],
  });
  s.navigate("owned", "a");
  s.w.movePanel(s.w.layout.getActivePanel("main")!.instanceId, "side");
  s.navigate("bare");
  registration.dispose();
  s.navigate("alpha-list");
  expect(s.ids("side")).toEqual([]);
  expect(s.w.shell.getRegionState("side").open).toBe(false);
});

test("an explicit single-slot open replaces shared content", () => {
  const s = modePanelFixture();
  s.w.pages.registerPage({
    id: "tools",
    ref: pageRef("tools"),
    path: "tools",
    modeId: "alpha",
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
    slots: [
      {
        id: "viewer",
        region: "side",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "document" }],
            view: { kind: "view", id: "document" },
            cardinality: "one",
          },
        },
      },
    ],
  });
  s.navigate("tools");
  s.w.pages.openSlot({ pageId: "tools", slotId: "viewer", resource: { type: "document", id: "a" } });
  const original = s.w.layout.listPanelInstances("side")[0]!;
  s.w.pages.openSlot({ pageId: "tools", slotId: "viewer", resource: { type: "document", id: "b" } });
  expect(s.ids("side")).toEqual(["b"]);
  expect(s.w.layout.listPanelInstances("side")[0]?.instanceId).toBe(original.instanceId);
});

test("a moved page tab accepts section navigation without changing its panel", () => {
  const s = modePanelFixture();
  s.navigate("document", "a");
  s.w.movePanel(s.w.layout.getActivePanel("main")!.instanceId, "side");
  const section = { anchors: [{ id: "details", heading: "Details" }] };
  expect(
    s.w.pageLocations.navigate({
      kind: "page",
      page: pageRef("document"),
      resource: { type: "document", id: "a" },
      section,
    }).ok,
  ).toBe(true);
  expect(s.w.layout.getLayout().regions.side.widgets[0]?.section).toEqual(section);
});
