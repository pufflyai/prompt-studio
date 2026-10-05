import { expect, test } from "bun:test";
import { getActiveLocationPlacement } from "../../registries/layout/layout-operations";
import { createWorkbench } from "../../workbench-core";
import { harness, navigate, openFile, panel, resource } from "./placement-lifecycle-test-support";

test("mixed page and mode order survives navigation and a fresh workbench", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("one"));
  w.pinPlacement(w.layout.getLayout().regions.main.widgets[0]!.placementIdentity!);
  await w.navigation.openTarget(openFile("two"));
  w.pinPlacement(w.layout.getLayout().regions.main.widgets[1]!.placementIdentity!);
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("session"), open: "pin" });
  w.movePanel(w.layout.getLayout().regions.side.widgets[0]!.widgetId, "main", {
    beforeWidgetId: w.layout.getLayout().regions.main.widgets[1]!.widgetId,
  });
  const order = (core: typeof w) => core.layout.getLayout().regions.main.widgets.map((tab) => tab.resource?.id);
  expect(order(w)).toEqual(["one", "session", "two"]);
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget(navigate("alpha"));
  expect(order(w)).toEqual(["one", "session", "two"]);
  const restored = harness(saved);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(order(restored)).toEqual(["one", "session", "two"]);
});

test("opening an existing moved panel reveals its actual destination", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  const target = { kind: "panel", panel, resource: resource("session"), open: "pin" } as const;
  await w.navigation.openTarget(target);
  const session = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(session.widgetId, "secondary");
  w.shell.setRegionOpen("secondary", false);
  w.sidePanel.setMode("closed");
  await w.navigation.openTarget(target);
  expect(w.layout.getLayout().regions.secondary.visible).toBe(true);
  expect(w.sidePanel.getMode()).toBe("closed");
  expect(w.layout.getLayout().regions.secondary.activeWidgetId).toBe(session.widgetId);
});

test("a page restores mixed positions while preserving the shared mode tab order", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("page-file"));
  w.pinPlacement(w.layout.getLayout().regions.main.widgets[0]!.placementIdentity!);
  for (const id of ["a", "b"]) {
    await w.navigation.openTarget({ kind: "panel", panel, resource: resource(id), open: "pin" });
    w.movePanel(w.layout.getLayout().regions.side.widgets[0]!.widgetId, "main");
  }
  await w.navigation.openTarget(navigate("beta"));
  const tabs = w.layout.getLayout().regions.main.widgets;
  w.layout.reorderPanel(tabs.find((tab) => tab.resource?.id === "b")!.widgetId, {
    beforeWidgetId: tabs.find((tab) => tab.resource?.id === "a")!.widgetId,
  });
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.main.widgets.map((tab) => tab.resource?.id)).toEqual(["page-file", "b", "a"]);
});

test("moving a preview preserves ownership, content identity and the page route", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("draft"), open: "preview" });
  const original = w.layout.getLayout().regions.side.widgets[0]!;
  const location = w.pages.store.getState().location;
  w.movePanel(original.widgetId, "main", "start");
  expect(w.layout.getLayout().regions.side.widgets).toEqual([]);
  expect(w.layout.getLayout().regions.main.widgets[0]).toBe(original);
  expect(w.layout.getLayout().regions.main.activeWidgetId).toBe(original.widgetId);
  expect(w.pages.store.getState().location).toEqual(location);
  w.pinPlacement(original.placementIdentity!);
  w.pinPlacement(original.placementIdentity!, false);
  expect(w.layout.getLayout().regions.main.widgets[0]).toMatchObject({
    widgetId: original.widgetId,
    placementIdentity: original.placementIdentity,
    tabRetention: "preview",
  });
});

test("moving the page view keeps its primary anchor and selection in Side", async () => {
  const w = harness();
  const pageRef = { kind: "page", extensionId: "test", id: "page-view" } as const;
  w.pages.registerPage({
    id: "page-view",
    ref: pageRef,
    parentId: "workspace",
    path: "page-view",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
    slots: [],
  });
  await w.navigation.openTarget({ kind: "page", page: pageRef, resource: { type: "workspace", id: "alpha" } });
  const original = w.layout.getLayout().regions.main.widgets[0]!;
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("session"), open: "pin" });
  w.movePanel(original.widgetId, "side");
  expect(w.layout.getLayout().regions.side.activeWidgetId).toBe(original.widgetId);
  expect(getActiveLocationPlacement(w.layout.getLayout())?.widgetId).toBe(original.widgetId);
  expect(w.getPrimaryResource()?.id).toBe("alpha");
  w.layout.setRegionActiveWidget("side", original.widgetId);
  expect(w.layout.getLayout().activeLocationWidgetId).toBe(original.widgetId);
});

test("moving a page selects it over its remembered auxiliary tab", async () => {
  const w = harness();
  const pageRef = { kind: "page", extensionId: "test", id: "page-view" } as const;
  w.pages.registerPage({
    id: "page-view",
    ref: pageRef,
    parentId: "workspace",
    path: "page-view",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
    slots: [],
  });
  await w.navigation.openTarget({ kind: "page", page: pageRef, resource: { type: "workspace", id: "alpha" } });
  const pageView = w.layout.getLayout().regions.main.widgets[0]!;
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("session"), open: "pin" });
  const session = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(session.widgetId, "main");
  w.movePanel(pageView.widgetId, "side");
  w.movePanel(pageView.widgetId, "main");
  expect(w.layout.getLayout().regions.main.activeWidgetId).toBe(pageView.widgetId);
  expect(w.layout.getLayout().activeWidgetId).toBe(pageView.widgetId);
});

test("moving a location keeps the source's next tab selected", () => {
  const w = createWorkbench();
  for (const id of ["one", "two"]) {
    w.layout.registerPanel({ id, title: id, rendererId: id, region: "main" });
    w.layout.openWidget(id, { role: "location", resource: resource(id) });
  }
  const [first, second] = w.layout.getLayout().regions.main.widgets;
  expect(first).toBeDefined();
  expect(second).toBeDefined();
  w.movePanel(second!.widgetId, "secondary");
  expect(w.layout.getLayout().regions.main.activeWidgetId).toBe(first!.widgetId);
  expect(w.layout.getLayout().regions.secondary.activeWidgetId).toBe(second!.widgetId);
});

test("Add reuses a single panel from another region and follows move restrictions", async () => {
  const w = harness();
  w.modePlacements.registerPlacement({
    id: "notes",
    ref: { kind: "placement", extensionId: "test", id: "notes" },
    modeId: "edit",
    region: "secondary",
    movableTo: ["secondary", "side"],
    item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "open" },
  });
  await w.navigation.openTarget(navigate("alpha"));
  const original = w.layout.getLayout().regions.secondary.widgets[0]!;
  expect(w.getPanelDestinations(original.widgetId)).toEqual(["secondary", "side"]);
  expect(() => w.movePanel(original.widgetId, "main")).toThrow("cannot move");
  const add = w.composition.panelsFor("side").addable.find((p) => p.contribution.title === "editor");
  expect(add).toBeDefined();
  await add?.open?.();
  expect(w.layout.getLayout().regions.side.widgets[0]?.widgetId).toBe(original.widgetId);
  expect(w.layout.getLayout().regions.secondary.widgets).toEqual([]);
});

test("page and shared mode placements restore their chosen regions after navigation and reload", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("file"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("session"), open: "pin" });
  const pageTab = w.layout.getLayout().regions.main.widgets[0]!;
  const modeTab = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(pageTab.widgetId, "secondary");
  w.movePanel(modeTab.widgetId, "main");
  await w.navigation.openTarget(navigate("beta"));
  expect(w.layout.getLayout().regions.main.widgets.some((t) => t.widgetId === modeTab.widgetId)).toBe(true);
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.secondary.widgets[0]?.widgetId).toBe(pageTab.widgetId);
  const restored = harness(saved);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.layout.getLayout().regions.secondary.widgets[0]?.widgetId).toBe(pageTab.widgetId);
  expect(restored.layout.getLayout().regions.main.widgets.some((t) => t.widgetId === modeTab.widgetId)).toBe(true);
});

test("preview and pinned tabs can be interleaved without pinning changing their order", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("pinned"));
  const pinned = w.layout.getLayout().regions.main.widgets[0]!;
  w.pinPlacement(pinned.placementIdentity!);
  await w.navigation.openTarget(openFile("preview"));
  const preview = w.layout.getLayout().regions.main.widgets[1]!;
  w.layout.reorderPanel(preview.widgetId, { beforeWidgetId: pinned.widgetId });
  w.pinPlacement(preview.placementIdentity!);
  w.pinPlacement(preview.placementIdentity!, false);
  expect(w.layout.getLayout().regions.main.widgets.map((t) => t.resource?.id)).toEqual(["preview", "pinned"]);
});

test("Add opens an active mode panel in the chosen region and reset restores its declared defaults", async () => {
  const w = harness();
  w.modePlacements.registerPlacement({
    id: "notes",
    ref: { kind: "placement", extensionId: "test", id: "notes" },
    modeId: "edit",
    region: "secondary",
    item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "open" },
  });
  await w.navigation.openTarget(navigate("alpha"));
  const notes = w.layout.getLayout().regions.secondary.widgets[0]!;
  w.closePlacement(notes.placementIdentity!);
  const addable = w.composition.panelsFor("side").addable.find((p) => p.contribution.title === "editor")!;
  expect(addable).toBeDefined();
  await addable.open?.();
  expect(w.layout.getLayout().regions.side.widgets[0]?.placementIdentity).toEqual(notes.placementIdentity);
  w.resetLayout();
  expect(w.layout.getLayout().regions.secondary.widgets[0]?.placementIdentity).toEqual(notes.placementIdentity);
  expect(w.layout.getLayout().regions.side.widgets).toEqual([]);
});

test("reset changes the active page and shared mode while preserving another page's choices", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("file"));
  const file = w.layout.getLayout().regions.main.widgets[0]!;
  w.pinPlacement(file.placementIdentity!);
  w.movePanel(file.widgetId, "secondary");
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("session"), open: "pin" });
  w.resetLayout();
  expect(w.layout.getLayout().regions.side.widgets).toEqual([]);
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.secondary.widgets[0]?.widgetId).toBe(file.widgetId);
  expect(w.layout.getLayout().regions.side.widgets).toEqual([]);
});
