import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";

const page = { kind: "page" as const, extensionId: "example", id: "library" };
const legacy = { kind: "page-slot" as const, page, id: "list" };
const panel = { kind: "placement" as const, extensionId: "example", id: "list" };
const fixture = (saved = new Map<string | undefined, WorkbenchLayout>(), old = false) => {
  const w = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, structuredClone(layout)),
      listLayouts: () => [...saved].map(([scope, layout]) => ({ scope, layout })),
    },
  });
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({ id: "list", title: "Library", body: { kind: "react", render: () => null } });
  if (!old)
    w.modePlacements.registerPlacement({
      id: "list",
      ref: panel,
      modeId: "project",
      region: "main",
      replaces: [legacy],
      item: { kind: "view", view: { kind: "view", id: "list" }, presence: "closed" },
    });
  w.pages.registerPage({
    id: "library",
    ref: page,
    path: "library",
    modeId: "project",
    main: { kind: "panels", landing: old ? "list" : panel },
    slots: old
      ? [{ id: "list", region: "main", item: { kind: "view", view: { kind: "view", id: "list" }, presence: "open" } }]
      : [],
  });
  w.pageLocations.setProject("project");
  w.pageLocations.navigate({ kind: "page", page });
  return { w, saved };
};

test("an independent placement accepts the public slot references it replaces", async () => {
  const { w } = fixture();
  await w.navigation.openTarget({ kind: "panel", panel: legacy });
  expect(w.layout.listPanelInstances("main")).toHaveLength(1);
  expect(w.layout.getActivePanel("main")?.placementIdentity).toMatchObject({ kind: "mode", placementId: "list" });
});

test("replaced page slots retain their moved region and singleton identity after reload", () => {
  const { w: old, saved } = fixture(undefined, true);
  const list = old.layout.getActivePanel("main")!;
  old.movePanel(list.instanceId, "side");
  const { w } = fixture(saved);
  expect(w.layout.listPanelInstances("main")).toHaveLength(0);
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
  expect(w.layout.getActivePanel("side")?.placementIdentity).toMatchObject({ kind: "mode", placementId: "list" });
});

const resource = (id: string) => ({ type: "record", id, extensionId: "example", projectId: "project" });
const bindingFixture = (saved = new Map<string | undefined, WorkbenchLayout>(), old = false) => {
  const w = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, structuredClone(layout)),
      listLayouts: () => [...saved].map(([scope, layout]) => ({ scope, layout })),
    },
  });
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({ id: "list", title: "Record", body: { kind: "react", render: () => null } });
  const item = {
    kind: "binding" as const,
    binding: {
      kinds: [{ kind: "resource-kind" as const, extensionId: "example", id: "record" }],
      view: { kind: "view" as const, id: "list" },
      cardinality: "many" as const,
    },
  };
  w.modePlacements.registerPlacement({
    id: "list",
    ref: panel,
    modeId: "project",
    region: "side",
    item,
    replaces: old ? undefined : [legacy],
  });
  w.pages.registerPage({
    id: "library",
    ref: page,
    path: "library",
    modeId: "project",
    main: { kind: "panels" },
    slots: old ? [{ id: "list", region: "main", item }] : [],
  });
  w.pageLocations.setProject("project");
  w.pageLocations.navigate({ kind: "page", page });
  return { w, saved };
};

test("replacement migration preserves a saved viewer's position and page context", () => {
  const { w: old, saved } = bindingFixture(undefined, true);
  old.pages.openSlot({ pageId: "library", slotId: "list", resource: resource("y"), open: "pin" });
  const identity = old.layout.getActivePanel("main")!.placementIdentity!;
  const pageContext = { page, parent: { page }, params: { folder: "one" } };
  old.pages.refreshPlacement(identity, { resource: resource("y"), position: { line: 8, column: 2 }, pageContext });
  old.movePanel(old.layout.getActivePanel("main")!.instanceId, "side");
  const { w } = bindingFixture(saved);
  expect(w.layout.getActivePanel("side")).toMatchObject({ position: { line: 8, column: 2 }, pageContext });
});

test("replacement migration prefers a switched canonical viewer with a different retained instance key", () => {
  const { w: old, saved } = bindingFixture(undefined, true);
  old.pages.openSlot({ pageId: "library", slotId: "list", resource: resource("y"), open: "pin" });
  old.movePanel(old.layout.getActivePanel("main")!.instanceId, "side");
  const canonical = old.modePlacements.openPlacement({ panel, resource: resource("x"), open: "pin" });
  old.modePlacements.updatePlacement(canonical, { resource: resource("y") });
  const { w } = bindingFixture(saved);
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
  expect(w.layout.getActivePanel("side")?.placementIdentity).toEqual(canonical);
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("y");
});
