import { expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../workbench-core";
import { createOwnedAddablePanels } from "../composition/owned-addable-panels";
import type { WorkbenchPageBrowserEntry } from "../page-location/page-location-controller";

const page = (id: string) => ({ kind: "page" as const, extensionId: "notes", id });
const panel = { kind: "placement" as const, extensionId: "tools", id: "editor" };
const resource: ResourceRef = {
  type: "note",
  id: "one",
  extensionId: "notes",
  projectId: "project",
  metadata: { document: "a" },
};
const harness = () => {
  const entries: WorkbenchPageBrowserEntry[] = [{ url: "/projects/project" }];
  const w = createWorkbench({
    startPage: page("home"),
    pageLocationBrowser: {
      current: () => entries.at(-1)!,
      push: (entry) => {
        entries.push(entry);
      },
      replace: (entry) => {
        entries[entries.length - 1] = entry;
      },
      back() {},
      forward() {},
      onPopState: () => ({ dispose() {} }),
    },
  });
  for (const modeId of ["project", "review"]) w.modes.registerMode({ id: modeId, activate() {} });
  for (const id of ["editor", "other", "home"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  const binding = {
    kinds: [{ kind: "resource-kind" as const, id: "note" }],
    view: { kind: "view" as const, id: "editor" },
    cardinality: "many" as const,
  };
  w.pages.registerPage({
    id: "home",
    ref: page("home"),
    path: "home",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "home" } },
    slots: [{ id: "editor", region: "side", item: { kind: "binding", binding } }],
  });
  for (const id of ["note", "another-tool", "review"])
    w.pages.registerPage({
      id,
      ref: page(id),
      path: id,
      modeId: id === "review" ? "review" : "project",
      parentId: "home",
      resource: { kinds: binding.kinds },
      document: { metadataKey: "document" },
      main: { kind: "view", view: binding.view, cardinality: "many" },
      slots: [],
    });
  w.modePlacements.registerPlacement({
    id: "editor",
    ref: panel,
    modeId: "project",
    region: "side",
    item: { kind: "binding", binding },
  });
  w.shellPlacements.registerPlacement({ id: "editor", region: "secondary", item: { kind: "binding", binding } });
  w.pageLocations.boot("project");
  const editors = () =>
    Object.values(w.layout.getLayout().regions)
      .flatMap((r) => r.widgets)
      .filter((p) => p.viewId === "editor");
  const route = () =>
    structuredClone({
      location: w.pages.store.getState().location,
      breadcrumbs: w.breadcrumbs.getItems()?.map((item) => ({ title: item.title, resource: item.resource })),
      history: w.pageLocations.historyStore.getState(),
      entries,
    });
  return { w, editors, route };
};

for (const region of ["main", "side", "secondary"] as const) {
  for (const entry of ["page", "mode", "shell", "slot", "add"] as const) {
    if (region === "main" && (entry === "slot" || entry === "add")) continue;
    for (const pinned of [true, false])
      test(`explicit opens reuse the moved editor across owners: ${region}, ${entry}, ${pinned ? "pinned" : "preview"}`, async () => {
        const s = harness();
        await s.w.navigation.openTarget({ kind: "page", page: page("note"), resource, open: "pin" });
        const original = s.editors()[0]!;
        s.w.movePanel(original.widgetId, region);
        if (region !== "main") await s.w.navigation.openTarget({ kind: "page", page: page("home") });
        if (!pinned) s.w.pinPlacement(original.placementIdentity!, false);
        const before = s.route();
        const current = s.editors()[0]!;
        const requestedRegion = region === "side" ? "secondary" : "side";
        if (entry === "page")
          await s.w.navigation.openTarget({
            kind: "page",
            page: page("another-tool"),
            resource,
            open: pinned ? "preview" : "pin",
          });
        if (entry === "mode")
          await s.w.navigation.openTarget({
            kind: "panel",
            panel,
            resource,
            region: requestedRegion,
            open: pinned ? "preview" : "pin",
          });
        if (entry === "shell")
          await s.w.navigation.openTarget({
            kind: "panel",
            panel: { kind: "shell-placement", id: "editor" },
            resource,
            region: requestedRegion,
            open: "pin",
          });
        if (entry === "slot")
          await s.w.navigation.openTarget({
            kind: "panel",
            panel: { kind: "page-slot", page: page("home"), id: "editor" },
            resource,
            region: requestedRegion,
            open: "pin",
          });
        if (entry === "add")
          await createOwnedAddablePanels(s.w, {
            layout: s.w.layout.getLayout(),
            modeId: "project",
            region: requestedRegion,
            resource,
          }).find((p) => p.panelId.endsWith("home.editor"))!.open!(resource);
        expect(s.editors()).toEqual([current]);
        expect(s.w.layout.getActivePanel(region)?.instanceId).toBe(original.widgetId);
        expect(s.route()).toEqual(before);
        expect(s.w.layout.getLayout().regions[region].visible).toBe(true);
      });
  }
}

for (const [name, other] of Object.entries({
  resource: { ...resource, id: "two" },
  project: { ...resource, projectId: "other" },
  extension: { ...resource, extensionId: "other" },
  document: { ...resource, metadata: { document: "b" } },
}))
  test(`different ${name} identities open separately`, async () => {
    const s = harness();
    await s.w.navigation.openTarget({ kind: "page", page: page("note"), resource, open: "pin" });
    s.w.movePanel(s.editors()[0]!.widgetId, "side");
    await s.w.navigation.openTarget({ kind: "page", page: page("another-tool"), resource: other, open: "pin" });
    expect(s.editors()).toHaveLength(2);
    expect(s.editors().map((p) => p.resource)).toContainEqual(other);
  });

test("an explicit open in another mode keeps that mode's own editor", async () => {
  const s = harness();
  await s.w.navigation.openTarget({ kind: "page", page: page("note"), resource, open: "pin" });
  const original = s.editors()[0]!;
  s.w.movePanel(original.widgetId, "side");
  await s.w.navigation.openTarget({ kind: "page", page: page("review"), resource, open: "pin" });
  expect(s.w.modes.getActiveModeId()).toBe("review");
  expect(s.editors()[0]!.widgetId).not.toBe(original.widgetId);
});

for (const entry of ["mode", "shell", "slot"] as const)
  test(`different documents opened through one ${entry} owner keep separate instances`, async () => {
    const s = harness();
    const panels = {
      mode: { kind: "panel" as const, panel },
      shell: { kind: "panel" as const, panel: { kind: "shell-placement" as const, id: "editor" } },
      slot: { kind: "panel" as const, panel: { kind: "page-slot" as const, page: page("home"), id: "editor" } },
    };
    for (const document of ["a", "b"])
      await s.w.navigation.openTarget({
        ...panels[entry],
        resource: { ...resource, metadata: { document } },
        open: "pin",
      });
    expect(s.editors()).toHaveLength(2);
    expect(s.editors().map((p) => p.resource?.metadata?.document)).toEqual(["a", "b"]);
  });

test("compound opens share the first editor across owners before publishing", async () => {
  const s = harness();
  await s.w.navigation.openTarget({
    kind: "compound",
    targets: [
      { kind: "panel", panel, resource, open: "pin", region: "side" },
      { kind: "page", page: page("another-tool"), resource, open: "preview" },
      { kind: "panel", panel: { kind: "shell-placement", id: "editor" }, resource, region: "secondary" },
    ],
  });
  expect(s.editors()).toHaveLength(1);
  expect(s.w.layout.getActivePanel("side")?.resource).toEqual(resource);
  expect(s.w.pages.store.getState().activePageId).toBe("home");
});

test("a later invalid compound target leaves a reused editor and navigation unchanged", async () => {
  const s = harness();
  await s.w.navigation.openTarget({ kind: "page", page: page("note"), resource, open: "pin" });
  s.w.movePanel(s.editors()[0]!.widgetId, "side");
  const before = { pages: s.w.pages.store.getState(), layout: s.w.layout.getLayout(), route: s.route() };
  await expect(
    s.w.navigation.openTarget({
      kind: "compound",
      targets: [
        { kind: "page", page: page("another-tool"), resource },
        { kind: "panel", panel, resource: { type: "wrong", id: "one" } },
      ],
    }),
  ).rejects.toThrow();
  expect({ pages: s.w.pages.store.getState(), layout: s.w.layout.getLayout(), route: s.route() }).toEqual(before);
});

test("different editor views of one document open separately", async () => {
  const s = harness();
  s.w.shellPlacements.registerPlacement({
    id: "other",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "note" }],
        view: { kind: "view", id: "other" },
        cardinality: "many",
      },
    },
  });
  await s.w.navigation.openTarget({ kind: "panel", panel, resource, open: "pin" });
  await s.w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "other" },
    resource,
    open: "pin",
  });
  expect(s.w.layout.listPanelInstances("side").map((p) => p.viewId)).toEqual(["editor", "other"]);
});

test("automatic and explicit auxiliary opens share the document instance", async () => {
  const s = harness();
  s.w.pages.registerPage({
    id: "with-follower",
    ref: page("with-follower"),
    path: "with-follower",
    modeId: "project",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "note" }] },
    document: { metadataKey: "document" },
    main: { kind: "view", view: { kind: "view", id: "other" }, cardinality: "many" },
    slots: [
      {
        id: "editor",
        region: "side",
        openOn: "page-resource",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "note" }],
            view: { kind: "view", id: "editor" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  const target = { kind: "page" as const, page: page("with-follower"), resource, open: "pin" as const };
  await s.w.navigation.openTarget(target);
  s.w.closePlacement(s.editors()[0]!.placementIdentity!);
  await s.w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "page-slot", page: page("with-follower"), id: "editor" },
    resource,
    open: "pin",
  });
  const editor = s.editors()[0]!;
  await s.w.navigation.openTarget(target);
  expect(s.editors()).toHaveLength(1);
  expect(s.editors()[0]!.widgetId).toBe(editor.widgetId);
});
