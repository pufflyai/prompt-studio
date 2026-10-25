import { expect, test } from "bun:test";
import { createMemoryWorkbenchPageLocationBrowser } from "../page-location/page-location-memory";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";

test("a Main viewer keeps its parameters and contextual parent when switching its resource", async () => {
  const { w } = createResourceViewerFixture();
  w.pages.getPage("reader")!.params = { filter: { type: "string" } };
  w.pages.registerPage({
    id: "container",
    ref: viewerPage("container"),
    path: "container",
    modeId: "project",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "folder" }] },
    main: { kind: "view", presentation: "page", view: { kind: "view", id: "browser" }, cardinality: "one" },
    slots: [],
  });
  await w.navigation.openPage({
    page: viewerPage("reader"),
    resource: viewerResource("x"),
    params: { filter: "mine" },
    parent: { kind: "page", page: viewerPage("container"), resource: viewerResource("folder-a", "folder") },
  });
  const before = w.pages.store.getState().location!;
  w.viewers.change(w.pages.getContent()!.placementIdentity!, {
    operation: "switch",
    from: viewerResource("x"),
    resource: viewerResource("y"),
  });
  expect(w.pages.store.getState().location).toMatchObject({
    resource: viewerResource("y"),
    params: before.params,
    parent: before.parent,
  });
});

for (const region of ["main", "side"] as const) {
  test(`a page-owned resource tab switches in ${region} without creating another tab`, async () => {
    const { w, openMain } = createResourceViewerFixture({ tabs: true });
    await openMain("x");
    const original = w.layout.getActivePanel("main")!;
    if (region === "side") w.movePanel(original.instanceId, "side");
    w.viewers.change(original.placementIdentity!, {
      operation: "switch",
      from: viewerResource("x"),
      resource: viewerResource("y"),
    });
    expect(w.layout.listPanelInstances(region)).toHaveLength(1);
    expect(w.layout.getActivePanel(region)).toMatchObject({
      resource: viewerResource("y"),
      tabRetention: "persistent",
    });
    if (region === "side") expect(w.layout.getActivePanel(region)?.instanceId).toBe(original.instanceId);
    if (region === "main") expect(w.pages.store.getState().location?.resource).toEqual(viewerResource("y"));
  });
  test(`a resource slot switches in ${region} without creating another tab`, () => {
    const { w } = createResourceViewerFixture();
    const home = w.pages.getPage("home")!;
    home.slots = [
      {
        id: "viewer",
        region,
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "record" }],
            view: { kind: "view", id: "reader" },
            cardinality: "many",
          },
        },
      },
    ];
    w.pages.registerPage({ ...home, id: "slots", ref: viewerPage("slots"), path: "slots" });
    w.pageLocations.navigate({ kind: "page", page: viewerPage("slots") });
    w.pages.openSlot({ pageId: "slots", slotId: "viewer", region, resource: viewerResource("x"), open: "pin" });
    const original = w.layout.getActivePanel(region)!;
    w.viewers.change(original.placementIdentity!, {
      operation: "switch",
      from: viewerResource("x"),
      resource: viewerResource("y"),
    });
    expect(w.layout.listPanelInstances(region)).toHaveLength(1);
    expect(w.layout.getActivePanel(region)).toMatchObject({
      instanceId: original.instanceId,
      resource: viewerResource("y"),
      tabRetention: "persistent",
    });
  });
}

test("Back does not reopen a resource deleted after its history entry was captured", async () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const { w, openMain } = createResourceViewerFixture({ browser });
  await openMain("deleted");
  await openMain("other");
  w.resources.removed(viewerResource("deleted"));
  w.pageLocations.goBack();
  expect(w.pages.getContent()?.resource).toBeUndefined();
  expect(w.getPrimaryResource()).toBeUndefined();
  expect(w.pageLocations.getBootLocation("project")?.resource).toBeUndefined();
  expect(new URL(browser.current().url, "http://workbench.test").searchParams.get("resource")).toBeNull();
});

test("a deletion after reload invalidates entries captured under an older removal clock", async () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const first = createResourceViewerFixture({ browser });
  for (let index = 0; index < 5; index++) first.w.resources.removed(viewerResource(`unrelated-${index}`));
  await first.openMain("deleted");
  await first.openMain("other");
  await first.w.dispose();
  const next = createResourceViewerFixture({ browser, saved: first.saved, locations: first.locations });
  next.w.pageLocations.boot("project");
  next.w.pageLocations.goBack();
  expect(next.w.pages.getContent()?.resource?.id).toBe("other");
  next.w.resources.removed(viewerResource("deleted"));
  next.w.pageLocations.goBack();
  expect(next.w.pages.getContent()?.resource).toBeUndefined();
});

test.each([
  false,
  true,
])("a deleted contextual parent is removed from a surviving resource (history: %s)", async (history) => {
  const { w, other } = createResourceViewerFixture();
  w.pages.registerPage({
    id: "container",
    ref: viewerPage("container"),
    path: "container",
    modeId: "project",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "folder" }] },
    main: { kind: "view", presentation: "page", view: { kind: "view", id: "browser" }, cardinality: "one" },
    slots: [],
  });
  await w.navigation.openPage({
    page: viewerPage("reader"),
    resource: viewerResource("x"),
    parent: { kind: "page", page: viewerPage("container"), resource: viewerResource("folder-a", "folder") },
  });
  if (history) other();
  w.resources.removed(viewerResource("folder-a", "folder"));
  if (history) w.pageLocations.goBack();
  expect(w.pages.getContent()?.resource?.id).toBe("x");
  expect(w.pages.store.getState().location?.parent).toEqual({ page: viewerPage("home") });
});

test("a viewer page transition uses the destination params and declared parent", () => {
  const { w, other } = createResourceViewerFixture();
  w.pages.getPage("other")!.params = { filter: { type: "string" } };
  w.pages.getPage("reader")!.parentId = "other";
  other();
  w.pageLocations.updateParams({ filter: "mine" });
  w.viewers.change(w.pages.getContent()!.placementIdentity!, {
    operation: "replace",
    page: viewerPage("reader"),
    resource: viewerResource("created"),
  });
  expect(w.pages.store.getState().location?.params).toBeUndefined();
  expect(w.pages.store.getState().location?.parent).toEqual({ page: viewerPage("other") });
});

test("history captured after an authoritative recreate may restore that resource", async () => {
  const { w, openMain } = createResourceViewerFixture();
  await openMain("deleted");
  await openMain("other");
  w.resources.removed(viewerResource("deleted"));
  await openMain("deleted");
  await openMain("next");
  w.pageLocations.goBack();
  expect(w.pages.getContent()?.resource?.id).toBe("deleted");
});
