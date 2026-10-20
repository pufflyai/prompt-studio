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

for (const region of ["side", "secondary"] as const) {
  test.each([
    "page controller",
    "navigation",
    "compound",
  ] as const)(`%s opens select an editor in ${region} without replacing Main or browser history`, async (entry) => {
    const { createMemoryWorkbenchPageLocationBrowser } = await import("../page-location/page-location-memory");
    const browser = createMemoryWorkbenchPageLocationBrowser();
    const s = fixture({ pageLocationBrowser: browser });
    s.w.pageLocations.navigate(s.target);
    const editor = s.w.layout.getActivePanel("main")!;
    s.w.movePanel(editor.instanceId, region);
    const location = s.w.pages.store.getState().location;
    const main = s.w.layout.getLayout().regions.main;
    const history = browser.current();
    const historyState = s.w.pageLocations.historyStore.getState();
    s.w.shell.setRegionOpen(region, false);
    const section = { anchors: [{ id: "focus", heading: "Focus" }] };
    const target = { ...s.target, resource: { ...s.resource, label: "Renamed" }, section };
    if (entry === "page controller") expect(s.w.pageLocations.navigate(target).ok).toBe(true);
    if (entry === "navigation") await s.w.navigation.openTarget(target);
    if (entry === "compound") await s.w.navigation.openTarget({ kind: "compound", targets: [target] });
    expect(s.w.pages.store.getState().location).toEqual(location);
    expect(s.w.pages.store.getState().activePageId).toBe("alpha-list");
    expect(s.w.layout.getLayout().regions.main.widgets).toEqual(main.widgets);
    expect(browser.current()).toBe(history);
    expect(s.w.pageLocations.historyStore.getState()).toEqual(historyState);
    expect(s.w.shell.getRegionState(region).open).toBe(true);
    expect(s.w.layout.getActivePanel()).toMatchObject({ instanceId: editor.instanceId, title: "Renamed", section });
    expect(s.w.layout.listPanelInstances().filter((panel) => panel.viewId === "editor")).toHaveLength(1);
  });
}

test("opening a moved editor in a compound action preserves the preceding Main navigation", async () => {
  const s = fixture();
  s.w.pageLocations.navigate(s.target);
  const editor = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(editor.instanceId, "side");
  await s.w.navigation.openTarget({
    kind: "compound",
    targets: [{ kind: "page", page: pageRef("alpha") }, s.target],
  });
  expect(s.w.pages.store.getState().activePageId).toBe("alpha");
  expect(s.w.layout.getActivePanel()?.instanceId).toBe(editor.instanceId);
  expect(s.w.layout.listPanelInstances("main").some((p) => p.viewId === "editor")).toBe(false);
});

test("opening a moved editor restores its mode's Main page", () => {
  const s = fixture();
  s.w.pageLocations.navigate(s.target);
  const editor = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(editor.instanceId, "side");
  s.w.layout.activatePanel(s.w.layout.getActivePanel("main")!.instanceId);
  s.w.pageLocations.navigate({ kind: "page", page: pageRef("beta") });
  expect(s.w.pageLocations.navigate(s.target).ok).toBe(true);
  expect(s.w.pages.store.getState().activePageId).toBe("alpha-list");
  expect(s.w.layout.getActivePanel()?.instanceId).toBe(editor.instanceId);
  expect(s.w.layout.getActivePanel("main")?.viewId).toBe("document");
});

test("a compound action can reopen an editor it just opened in Side without replacing Main", async () => {
  const s = fixture();
  await s.w.navigation.openTarget({
    kind: "compound",
    targets: [
      {
        kind: "panel",
        panel: { kind: "shell-placement", id: "editor" },
        resource: s.resource,
        region: "side",
        open: "pin",
      },
      s.target,
    ],
  });
  expect(s.w.pages.store.getState().activePageId).toBe("alpha");
  expect(s.w.layout.listPanelInstances("main").filter((p) => p.viewId === "editor")).toEqual([]);
  expect(s.w.layout.getActivePanel()?.viewId).toBe("editor");
});

test("reopening a moved document leaves a different document in Main even when their resource IDs match", () => {
  const s = fixture();
  s.w.pages.registerPage({
    ...s.w.pages.getPage("edit")!,
    id: "files",
    ref: pageRef("files"),
    path: "files",
    document: { metadataKey: "path" },
  });
  const a = { ...s.target, page: pageRef("files"), resource: { ...s.resource, metadata: { path: "a" } } };
  s.w.pageLocations.navigate(a);
  const editor = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(editor.instanceId, "side");
  s.w.pageLocations.navigate({ ...a, resource: { ...s.resource, metadata: { path: "b" } } });
  const location = s.w.pages.store.getState().location;
  const main = s.w.layout.getActivePanel("main")!;
  s.w.pageLocations.navigate(a);
  expect(s.w.pages.store.getState().location).toEqual(location);
  expect(s.w.layout.getActivePanel("main")?.instanceId).toBe(main.instanceId);
  expect(s.w.layout.getActivePanel()?.instanceId).toBe(editor.instanceId);
});

test("Back and Forward keep the URL aligned with Main when an editor has moved", async () => {
  const { createMemoryWorkbenchPageLocationBrowser } = await import("../page-location/page-location-memory");
  const { serializeWorkbenchPageUrl } = await import("pstdio-api-contracts");
  const { getWorkbenchPageRegistryInternals } = await import("../../registries/pages/page-registry-internals");
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const s = fixture({ pageLocationBrowser: browser });
  s.w.pageLocations.navigate(s.target);
  s.w.pageLocations.navigate({ kind: "page", page: pageRef("alpha") });
  s.w.pageLocations.navigate(s.target);
  s.w.movePanel(s.w.layout.getActivePanel("main")!.instanceId, "side");
  for (const action of [browser.back, browser.back, browser.forward, browser.forward]) {
    action();
    expect(browser.current().url).toBe(
      serializeWorkbenchPageUrl({
        projectId: "project",
        location: s.w.pages.store.getState().location!,
        pages: s.w.pages.listPages(),
        resources: getWorkbenchPageRegistryInternals(s.w.pages).resources,
      }),
    );
  }
});

test("boot resolves the requested project's moved editor before that project is active", async () => {
  const { createMemoryWorkbenchPageLocationBrowser, createMemoryWorkbenchPageLocationPersistence } = await import(
    "../page-location/page-location-memory"
  );
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const persistence = createMemoryWorkbenchPageLocationPersistence();
  const s = fixture({ pageLocationBrowser: browser, pageLocationPersistence: persistence });
  s.w.pageLocations.navigate(s.target);
  const copied = browser.current();
  const editor = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(editor.instanceId, "side");
  s.w.pageLocations.navigate({ kind: "page", page: pageRef("beta") });
  s.w.pageLocations.clearProject();
  browser.replace(copied);
  expect(s.w.pageLocations.boot("project").ok).toBe(true);
  expect(s.w.pages.store.getState().activePageId).toBe("alpha-list");
  expect(s.w.layout.getActivePanel("side")?.instanceId).toBe(editor.instanceId);
  expect(s.w.layout.getActivePanel("main")?.viewId).toBe("document");
});

test("restoring a saved Main snapshot still selects the moved editor requested by its copied URL", async () => {
  const { createMemoryWorkbenchPageLocationBrowser } = await import("../page-location/page-location-memory");
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const s = fixture({ pageLocationBrowser: browser });
  s.w.pageLocations.navigate(s.target);
  const copied = browser.current();
  const editor = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(editor.instanceId, "side");
  s.w.layout.activatePanel(s.w.layout.getActivePanel("main")!.instanceId);
  browser.replace(copied);
  expect(s.w.pageLocations.boot("project").ok).toBe(true);
  expect(s.w.pages.store.getState().activePageId).toBe("alpha-list");
  expect(s.w.layout.getActivePanel()?.instanceId).toBe(editor.instanceId);
});
