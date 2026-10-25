import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";

for (const collection of [false, true]) {
  test(`selecting a retained viewer cannot restore its deleted parent (independent: ${collection})`, async () => {
    const { w } = createResourceViewerFixture({ tabs: !collection, collection });
    w.pages.registerPage({
      id: "container",
      ref: viewerPage("container"),
      path: "container",
      modeId: "project",
      parentId: "home",
      resource: { kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "folder" }] },
      main: { kind: "view", view: { kind: "view", id: "browser" }, presentation: "page", cardinality: "one" },
      slots: [],
    });
    await w.navigation.openPage({
      page: viewerPage("reader"),
      resource: viewerResource("x"),
      open: "pin",
      parent: { kind: "page", page: viewerPage("container"), resource: viewerResource("folder", "folder") },
    });
    const first = w.layout.getActivePanel("main")!;
    await w.navigation.openPage({ page: viewerPage("reader"), resource: viewerResource("y"), open: "pin" });
    w.resources.removed(viewerResource("folder", "folder"));
    w.layout.activatePanel(first.instanceId);
    expect(w.pages.store.getState().location?.resource?.id).toBe("x");
    expect(w.pages.store.getState().location?.parent).toEqual({ page: viewerPage("home") });
  });
}

test("resource removal also cleans a promoted contextual parent", async () => {
  const { w } = createResourceViewerFixture({ landing: false });
  const reader = w.pages.getPage("reader")!;
  if (reader.main.kind !== "view") throw new Error("Expected resource page");
  w.pages.registerPage({
    id: "container",
    ref: viewerPage("container"),
    path: "container",
    modeId: "project",
    parentId: "home",
    resource: reader.resource,
    main: { kind: "view", view: { kind: "view", id: "browser" }, presentation: "page", cardinality: "one" },
    slots: [],
  });
  await w.navigation.openPage({
    page: viewerPage("reader"),
    resource: viewerResource("x"),
    parent: { kind: "page", page: viewerPage("container"), resource: viewerResource("x") },
  });
  w.resources.removed(viewerResource("x"));
  expect(w.pages.store.getState().location).toEqual({ page: viewerPage("home") });
});

for (const collection of [false, true]) {
  test(`deleting a parent cleans a cached viewer before reload (independent: ${collection})`, async () => {
    const first = createResourceViewerFixture({ tabs: !collection, collection });
    const w = first.w;
    const container = {
      id: "container",
      ref: viewerPage("container"),
      path: "container",
      modeId: "project",
      parentId: "home",
      resource: { kinds: [{ kind: "resource-kind" as const, extensionId: "example.readers", id: "folder" }] },
      main: {
        kind: "view" as const,
        view: { kind: "view" as const, id: "browser" },
        presentation: "page" as const,
        cardinality: "one" as const,
      },
      slots: [],
    };
    w.pages.registerPage(container);
    await w.navigation.openPage({
      page: viewerPage("reader"),
      resource: viewerResource("x"),
      open: "pin",
      parent: { kind: "page", page: viewerPage("container"), resource: viewerResource("folder", "folder") },
    });
    first.other();
    w.resources.removed(viewerResource("folder", "folder"));
    const next = createResourceViewerFixture({
      tabs: !collection,
      collection,
      saved: first.saved,
      locations: first.locations,
    });
    next.w.pages.registerPage(container);
    await next.w.navigation.openPage({ page: viewerPage("reader"), resource: viewerResource("y"), open: "pin" });
    const cached = next.w.layout.getLayout().regions.main.widgets.find((widget) => widget.resource?.id === "x")!;
    next.w.layout.activatePanel(cached.widgetId);
    expect(next.w.pages.store.getState().location?.resource?.id).toBe("x");
    expect(next.w.pages.store.getState().location?.parent).toEqual({ page: viewerPage("home") });
  });
}
