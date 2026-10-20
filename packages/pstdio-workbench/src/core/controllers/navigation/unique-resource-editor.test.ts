import { expect, test } from "bun:test";
import { modePanelFixture, pageRef } from "../page-runtime/mode-panel-state.fixture";

const fixture = (input?: import("../../workbench-core-types").createWorkbenchInput) => {
  const s = modePanelFixture(undefined, true, [], input);
  s.w.views.registerView({
    id: "editor",
    title: "Editor",
    instancePolicy: "per-resource",
    body: { kind: "react", render: () => null },
  });
  s.w.pages.registerPage({
    id: "edit",
    ref: pageRef("edit"),
    path: "edit",
    modeId: "alpha",
    parentId: "alpha-list",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  });
  s.w.shellPlacements.registerPlacement({
    id: "editor",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "editor" },
        kinds: [{ kind: "resource-kind", id: "document" }],
        cardinality: "many",
      },
    },
  });
  const resource = { type: "document", id: "a", extensionId: "test", projectId: "project" };
  const target = { kind: "page" as const, page: pageRef("edit"), resource, open: "pin" as const };
  return { ...s, resource, target };
};

test("explicit page and panel opens select the same moved resource editor without changing its tray or retention", async () => {
  const s = fixture();
  expect(s.w.pageLocations.navigate(s.target).ok).toBe(true);
  const original = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(original.instanceId, "secondary");
  expect(s.w.pages.store.getState().activePageId).toBe("alpha-list");
  await s.w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "editor" },
    resource: s.resource,
    region: "side",
    open: "preview",
  });
  expect(s.w.layout.listPanelInstances("side")).toEqual([]);
  expect(s.w.layout.getActivePanel("secondary")?.instanceId).toBe(original.instanceId);
  expect(s.w.layout.listPanelInstances("secondary")[0]?.tabRetention).toBe("persistent");
  expect(s.w.pageLocations.navigate(s.target).ok).toBe(true);
  expect(s.w.layout.listPanelInstances("main").filter((tab) => tab.viewId === "editor")).toEqual([]);
  expect(s.w.layout.getActivePanel("secondary")?.instanceId).toBe(original.instanceId);
});

test("unique editors distinguish the full resource identity", async () => {
  const s = fixture();
  await s.w.navigation.openTarget(s.target);
  s.w.movePanel(s.w.layout.getActivePanel("main")!.instanceId, "side");
  await s.w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "editor" },
    resource: { ...s.resource, extensionId: "other" },
    open: "pin",
  });
  expect(s.w.layout.listPanelInstances("side")).toHaveLength(2);
});

test("moving an inactive routed editor preserves Main selection and only the final move uses the collection", () => {
  const s = fixture();
  s.w.pageLocations.navigate(s.target);
  const a = s.w.layout.getActivePanel("main")!;
  s.w.pageLocations.navigate({ ...s.target, resource: { ...s.resource, id: "b" } });
  const b = s.w.layout.getActivePanel("main")!;
  s.w.layout.openWidget(a.panelId, { resource: s.resource, role: "content", pinned: true });
  const inactive = s.w.layout.getActivePanel("main")!;
  s.w.layout.activatePanel(b.instanceId);
  s.w.movePanel(inactive.instanceId, "side");
  expect(s.w.layout.getActivePanel("main")?.instanceId).toBe(b.instanceId);
  expect(s.w.getPrimaryResource()?.id).toBe("b");
  s.w.movePanel(b.instanceId, "secondary");
  expect(s.w.pages.store.getState().activePageId).toBe("alpha-list");
  expect(s.w.layout.listPanelInstances("secondary")[0]?.resource).toMatchObject({ id: "b" });
});

test("closing a reused editor clears its opening across owners", async () => {
  const s = fixture();
  s.w.pageLocations.navigate(s.target);
  const original = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(original.instanceId, "side");
  await s.w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "editor" },
    resource: s.resource,
    open: "pin",
  });
  s.w.closePlacement(original.placementIdentity!);
  s.w.pageLocations.navigate({ kind: "page", page: pageRef("alpha") });
  expect(s.w.layout.listPanelInstances("side").filter((tab) => tab.viewId === "editor")).toEqual([]);
});

test("a rejected destination leaves the unique editor, owners and history unchanged", async () => {
  const s = fixture();
  s.w.pageLocations.navigate(s.target);
  const original = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(original.instanceId, "side");
  s.w.modes.registerMode({ id: "restricted", panels: ["main"], activate() {} });
  s.w.pages.registerPage({
    id: "restricted",
    ref: pageRef("restricted"),
    path: "restricted",
    modeId: "restricted",
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
    slots: [],
  });
  s.w.pageLocations.navigate({ kind: "page", page: pageRef("restricted") });
  const state = s.w.pages.store.getState();
  const layout = s.w.layout.getLayout();
  await expect(
    s.w.navigation.openTarget({
      kind: "panel",
      panel: { kind: "shell-placement", id: "editor" },
      resource: s.resource,
      region: "secondary",
    }),
  ).rejects.toThrow();
  expect(s.w.pages.store.getState()).toBe(state);
  expect(s.w.layout.getLayout()).toBe(layout);
});

test("closing an editor reused from another page does not recreate it from that page's binding", () => {
  const s = fixture();
  s.w.pages.registerPage({
    ...s.w.pages.getPage("edit")!,
    id: "edit-copy",
    ref: pageRef("edit-copy"),
    path: "edit-copy",
  });
  s.w.pageLocations.navigate(s.target);
  const original = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(original.instanceId, "side");
  s.w.pageLocations.navigate({ ...s.target, page: pageRef("edit-copy") });
  s.w.closePlacement(original.placementIdentity!);
  expect(s.w.layout.listPanelInstances("main").filter((tab) => tab.viewId === "editor")).toEqual([]);
  expect(s.w.layout.listPanelInstances("side").filter((tab) => tab.viewId === "editor")).toEqual([]);
});

test("closing an editor opened through a panel first clears a later page open", async () => {
  const s = fixture();
  await s.w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "editor" },
    resource: s.resource,
    open: "pin",
  });
  const original = s.w.layout.getActivePanel("side")!;
  s.w.pageLocations.navigate(s.target);
  s.w.closePlacement(original.placementIdentity!);
  expect(s.w.layout.listPanelInstances("side").filter((tab) => tab.viewId === "editor")).toEqual([]);
});

test("opening a hidden Main editor restores its owner and stable mounted identity", async () => {
  const s = fixture();
  s.w.pageLocations.navigate(s.target);
  const original = s.w.layout.getActivePanel("main")!;
  s.w.pageLocations.navigate({ kind: "page", page: pageRef("alpha") });
  await s.w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "editor" },
    resource: s.resource,
    open: "pin",
  });
  expect(s.w.pages.store.getState().activePageId).toBe("edit");
  expect(s.w.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
  expect(s.w.layout.listPanelInstances("side")).toEqual([]);
});

test("reopening a unique editor updates its heading and label while preserving the instance", () => {
  const s = fixture();
  const first = { anchors: [{ id: "first", heading: "First" }] };
  const second = { anchors: [{ id: "second", heading: "Second" }] };
  s.w.pageLocations.navigate({ ...s.target, section: first });
  const original = s.w.layout.getActivePanel("main")!;
  s.w.pageLocations.navigate({ ...s.target, resource: { ...s.resource, label: "Renamed" }, section: second });
  expect(s.w.layout.getActivePanel("main")).toMatchObject({
    instanceId: original.instanceId,
    title: "Renamed",
    section: second,
  });
});

test("a failed fallback history write leaves the move and its owners unchanged", async () => {
  const { createMemoryWorkbenchPageLocationBrowser } = await import("../page-location/page-location-memory");
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const s = fixture({ pageLocationBrowser: browser });
  s.w.pageLocations.navigate({ ...s.target, open: "preview" });
  const original = s.w.layout.getActivePanel("main")!;
  const layout = s.w.layout.getLayout();
  const state = s.w.pages.store.getState();
  browser.replace = () => {
    throw new Error("history blocked");
  };
  expect(() => s.w.movePanel(original.instanceId, "side")).toThrow("history blocked");
  expect(s.w.layout.getLayout()).toBe(layout);
  expect(s.w.pages.store.getState()).toBe(state);
});

test("a hidden manual Main editor is selected after restoring its page", async () => {
  const s = fixture();
  await s.w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "editor" },
    resource: s.resource,
    region: "main",
    open: "pin",
  });
  const original = s.w.layout.getActivePanel("main")!;
  s.w.pageLocations.navigate({ kind: "page", page: pageRef("alpha-list") });
  await s.w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "editor" },
    resource: s.resource,
    open: "pin",
  });
  expect(s.w.pages.store.getState().activePageId).toBe("alpha");
  expect(s.w.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
});

test("direct URL restoration reuses the original hidden editor across page declarations", async () => {
  const { createMemoryWorkbenchPageLocationBrowser } = await import("../page-location/page-location-memory");
  const { serializeWorkbenchPageUrl } = await import("pstdio-api-contracts");
  const { getWorkbenchPageRegistryInternals } = await import("../../registries/pages/page-registry-internals");
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const s = fixture({ pageLocationBrowser: browser });
  s.w.pages.registerPage({ ...s.w.pages.getPage("edit")!, id: "copy", ref: pageRef("copy"), path: "copy" });
  s.w.pageLocations.navigate(s.target);
  const original = s.w.layout.getActivePanel("main")!;
  s.w.pageLocations.navigate({ kind: "page", page: pageRef("alpha") });
  browser.replace({
    url: serializeWorkbenchPageUrl({
      projectId: "project",
      location: { page: pageRef("copy"), resource: s.resource },
      pages: s.w.pages.listPages(),
      resources: getWorkbenchPageRegistryInternals(s.w.pages).resources,
    }),
  });
  expect(s.w.pageLocations.boot("project").ok).toBe(true);
  expect(s.w.pages.store.getState().activePageId).toBe("edit");
  expect(s.w.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
});

test("opening a page for an existing manual Main peer preserves its owner's address", async () => {
  const s = fixture();
  await s.w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "editor" },
    resource: s.resource,
    region: "main",
    open: "pin",
  });
  const original = s.w.layout.getActivePanel("main")!;
  expect(s.w.pageLocations.navigate(s.target)).toMatchObject({ ok: true });
  expect(s.w.pages.store.getState().activePageId).toBe("alpha");
  expect(s.w.getPrimaryResource()).toBeUndefined();
  expect(s.w.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
});

test("reopening a manual Main peer updates its heading and label without changing its owner route", async () => {
  const s = fixture();
  await s.w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "editor" },
    resource: s.resource,
    region: "main",
    open: "pin",
  });
  const original = s.w.layout.getActivePanel("main")!;
  const owner = s.w.pages.store.getState().location;
  const section = { anchors: [{ id: "second", heading: "Second" }] };
  expect(
    s.w.pageLocations.navigate({
      ...s.target,
      resource: { ...s.resource, label: "Renamed" },
      section,
    }).ok,
  ).toBe(true);
  expect(s.w.pages.store.getState().location).toEqual(owner);
  expect(s.w.layout.getActivePanel("main")).toMatchObject({
    instanceId: original.instanceId,
    title: "Renamed",
    section,
  });
});

test("moving a final preview editor pins it before returning to its collection", () => {
  const s = fixture();
  s.w.pageLocations.navigate({ ...s.target, open: "preview" });
  const editor = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(editor.instanceId, "side");
  expect(s.w.pages.store.getState().activePageId).toBe("alpha-list");
  expect(s.w.shell.getRegionState("side").open).toBe(true);
  expect(s.w.layout.getActivePanel("side")).toMatchObject({
    instanceId: editor.instanceId,
    tabRetention: "persistent",
  });
});
