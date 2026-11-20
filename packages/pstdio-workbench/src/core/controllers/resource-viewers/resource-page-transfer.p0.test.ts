import { expect, test } from "bun:test";
import { resolveWebviewPageProps } from "../../../extensions/bridge/webview-page-props";
import { createWorkbench } from "../../workbench-core";
import { createResourceViewerFixture, viewerPage, viewerPanel, viewerResource } from "./resource-viewer-test-fixture";
import { viewerHostKey } from "./viewer-host-continuity";

test("opening a Side resource as a page transfers its live host into Main", async () => {
  const { w, openSide, openMain, side } = createResourceViewerFixture();
  await openSide("a");
  const source = side();
  const host = viewerHostKey(w, source.instanceId);
  await openMain("a");
  expect(w.pages.getContent()?.resource?.id).toBe("a");
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
  expect(w.shell.getPanelPolicy("side").open).toBe(false);
  expect(viewerHostKey(w, w.pages.getContent()!.widgetId)).toBe(host);
});

test("explicit panel opening transfers an existing resource into that panel", async () => {
  const { w, openMain, openSide } = createResourceViewerFixture();
  await openMain("a");
  const source = w.pages.getContent()!;
  const host = viewerHostKey(w, source.widgetId);
  await openSide("a");
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("a");
  expect(w.pages.getContent()?.resource?.id).not.toBe("a");
  expect(viewerHostKey(w, w.layout.getActivePanel("side")!.instanceId)).toBe(host);
});

test("opening a distinct semantic view of an existing resource reaches that renderer", async () => {
  const { w, openSide } = createResourceViewerFixture();
  w.views.registerView({ id: "history", title: "History", body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    ...w.pages.getPage("reader")!,
    id: "history",
    ref: viewerPage("history"),
    path: "history",
    panelView: undefined,
    main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "history" } },
  });
  await openSide("a");
  await w.navigation.openPage({ page: viewerPage("history"), resource: viewerResource("a") });
  expect(w.layout.getActivePanel("main")?.viewId).toBe("history");
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("a");
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
});

test("a page without a declared panel view can move independent resources into Side", async () => {
  const { w } = createResourceViewerFixture();
  w.pages.registerPage({
    ...w.pages.getPage("reader")!,
    id: "portable",
    ref: viewerPage("portable"),
    path: "portable",
    panelView: undefined,
  });
  for (const id of ["a", "b"]) {
    w.pageLocations.navigate({ kind: "page", page: viewerPage("portable"), resource: viewerResource(id), open: "pin" });
    const content = w.pages.getContent()!;
    const host = viewerHostKey(w, content.widgetId);
    expect(w.getPanelDestinations(content.widgetId)).toContain("side");
    w.movePanel(content.widgetId, "side");
    const moved = w.layout.listPanelInstances("side").find((item) => item.resource?.id === id)!;
    expect(moved).toBeDefined();
    expect(viewerHostKey(w, moved.instanceId)).toBe(host);
    expect(w.pages.getContent()?.resource?.id).not.toBe(id);
  }
  expect(w.layout.listPanelInstances("side").map((item) => item.resource?.id)).toEqual(["a", "b"]);
});

test("a rejected page transfer leaves the source, location and layout intact", async () => {
  const { w, openMain } = createResourceViewerFixture({ sideCanOpen: false });
  await openMain("a");
  w.shell.setRegionOpen("side", false);
  const source = w.pages.getContent();
  const location = w.pages.store.getState().location;
  const layout = w.layout.getLayout();
  expect(() => w.movePanel(source!.widgetId, "side")).toThrow();
  expect(w.pages.getContent()).toBe(source);
  expect(w.pages.store.getState().location).toBe(location);
  expect(w.layout.getLayout()).toBe(layout);
});

test("a resource-free page keeps its context and re-entry brings back its singleton", async () => {
  const { w } = createResourceViewerFixture();
  await w.navigation.openPage({ page: viewerPage("other") });
  const source = w.pages.getContent()!;
  const host = viewerHostKey(w, source.widgetId);
  w.movePanel(source.widgetId, "side");
  const moved = w.layout.getActivePanel("side")!;
  expect(moved.pageContext?.page).toEqual(viewerPage("other"));
  expect(viewerHostKey(w, moved.instanceId)).toBe(host);
  await w.navigation.openPage({ page: viewerPage("other") });
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
  expect(w.pages.getContent()?.viewId).toBe("browser");
  expect(viewerHostKey(w, w.pages.getContent()!.widgetId)).toBe(host);
});

test("a resource-free composer completes into its saved resource after moving", async () => {
  const { w } = createResourceViewerFixture();
  w.pages.registerPage({
    id: "composer",
    ref: viewerPage("composer"),
    path: "compose",
    modeId: "project",
    parentId: "home",
    main: { kind: "view", view: { kind: "view", id: "reader" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  await w.navigation.openPage({ page: viewerPage("composer") });
  const source = w.pages.getContent()!;
  const complete = w.viewers.capture(source.placementIdentity!)!;
  const host = viewerHostKey(w, source.widgetId);
  w.movePanel(source.widgetId, "side");
  expect(complete({ resource: viewerResource("saved"), operation: "replace", page: viewerPage("reader") })).toBe(
    "changed",
  );
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("saved");
  expect(viewerHostKey(w, w.layout.getActivePanel("side")!.instanceId)).toBe(host);
  expect(w.pages.store.getState().activePageId).toBe("home");
});

test("Back brings a moved resource to Main without adding a history entry", async () => {
  const { w, openMain } = createResourceViewerFixture();
  await openMain("a");
  w.movePanel(w.pages.getContent()!.widgetId, "side");
  expect(w.pages.store.getState().activePageId).toBe("home");
  w.pageLocations.goBack();
  expect(w.pages.getContent()?.resource?.id).toBe("a");
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
  expect(w.pageLocations.historyStore.getState().canGoForward).toBe(true);
  w.pageLocations.goForward();
  expect(w.pages.store.getState().activePageId).toBe("home");
});

test("switching a Main viewer to an existing Side resource brings it into Main", async () => {
  const { w, openMain, openSide } = createResourceViewerFixture();
  await openMain("a");
  await openSide("b");
  const source = w.pages.getContent()!;
  w.viewers.change(source.placementIdentity!, {
    operation: "switch",
    from: viewerResource("a"),
    resource: viewerResource("b"),
  });
  expect(w.pages.getContent()?.resource?.id).toBe("b");
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
});

test("a public regionless panel opening repairs the departing Main page", async () => {
  const { w, openMain } = createResourceViewerFixture();
  await openMain("a");
  await w.navigation.openPanel({ panel: viewerPanel, resource: viewerResource("a"), open: "pin" });
  expect(w.pages.store.getState().activePageId).toBe("home");
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("a");
});

test("compound navigation repairs staged Main departure and retains the final live host", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("a");
  const original = side();
  const host = viewerHostKey(w, original.instanceId);
  await w.navigation.openTarget({
    kind: "compound",
    targets: [
      { kind: "page", page: viewerPage("reader"), resource: viewerResource("a"), open: "pin" },
      { kind: "panel", panel: viewerPanel, resource: viewerResource("a"), region: "side", open: "pin" },
    ],
  });
  expect(w.pages.store.getState().activePageId).toBe("home");
  expect(side().instanceId).toBe(original.instanceId);
  expect(viewerHostKey(w, side().instanceId)).toBe(host);
});

for (const missingDefault of [false, true])
  test(`moving a non-default mode page preserves its mode; missing default=${missingDefault}`, () => {
    const w = createWorkbench({ defaultPage: viewerPage(missingDefault ? "missing" : "home") });
    for (const id of ["project", "settings"]) w.modes.registerMode({ id, activate() {} });
    w.views.registerView({ id: "settings", title: "Settings", body: { kind: "react", render: () => null } });
    w.pages.registerPage({
      id: "home",
      ref: viewerPage("home"),
      path: "home",
      modeId: "project",
      main: { kind: "panels" },
      slots: [],
    });
    w.pages.registerPage({
      id: "settings",
      ref: viewerPage("settings"),
      path: "settings",
      modeId: "settings",
      main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "settings" } },
      slots: [],
    });
    w.pageLocations.setProject("project");
    w.pageLocations.navigate({ kind: "page", page: viewerPage("settings") });
    w.movePanel(w.pages.getContent()!.widgetId, "side");
    expect(w.modes.getActiveModeId()).toBe("settings");
    expect(w.layout.getActivePanel("side")?.viewId).toBe("settings");
    expect(w.pages.getContent()).toBeUndefined();
  });

test("an ordinary page-slot viewer switches to an existing resource in its own panel", async () => {
  const { w, openSide } = createResourceViewerFixture();
  const page = w.pages.registerPage({
    id: "documents",
    ref: viewerPage("documents"),
    path: "documents",
    modeId: "project",
    main: { kind: "panels" },
    slots: [
      {
        id: "docs",
        region: "main",
        movableTo: ["main", "secondary"],
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "record" }],
            view: { kind: "view", id: "reader" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  await w.navigation.openPage({ page: viewerPage("documents") });
  await w.navigation.openPanel({
    panel: { kind: "page-slot", page: viewerPage("documents"), id: "docs" },
    resource: viewerResource("a"),
    open: "pin",
  });
  const source = w.layout.getActivePanel("main")!;
  await openSide("b");
  w.viewers.change(source.placementIdentity!, {
    operation: "switch",
    from: viewerResource("a"),
    resource: viewerResource("b"),
  });
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("b");
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
  page.dispose();
});

test("a moved page-slot viewer switches resources after leaving its owning page", async () => {
  const { w, openMain } = createResourceViewerFixture();
  w.pages.registerPage({
    id: "documents",
    ref: viewerPage("documents"),
    path: "documents",
    modeId: "project",
    main: { kind: "panels" },
    slots: [
      {
        id: "docs",
        region: "main",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "record" }],
            view: { kind: "view", id: "reader" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  await w.navigation.openPage({ page: viewerPage("documents") });
  await w.navigation.openPanel({
    panel: { kind: "page-slot", page: viewerPage("documents"), id: "docs" },
    resource: viewerResource("a"),
    open: "pin",
  });
  const source = w.layout.getActivePanel("main")!;
  const change = w.viewers.capture(source.placementIdentity!)!;
  w.movePanel(source.instanceId, "side");
  await openMain("b");
  const host = viewerHostKey(w, w.pages.getContent()!.widgetId);
  expect(change({ operation: "switch", resource: viewerResource("b") })).toBe("changed");
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("b");
  expect(w.pages.getContent()?.resource?.id).not.toBe("b");
  expect(viewerHostKey(w, w.layout.getActivePanel("side")!.instanceId)).toBe(host);
  expect(change({ operation: "replace", resource: viewerResource("stale") })).toBe("stale");
  expect(
    w.viewers.change(w.layout.getActivePanel("side")!.placementIdentity!, {
      operation: "switch",
      from: viewerResource("b"),
      resource: viewerResource("c"),
    }),
  ).toBe("changed");
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("c");
});

test("view menus use their moved owner's page parameters after Main and params change", async () => {
  const { w } = createResourceViewerFixture();
  w.views.registerView({ id: "changes", title: "Changes", body: { kind: "react", render: () => null } });
  w.viewMenus.registerViewMenu({ id: "changes", ownerViewId: "reader", viewId: "changes", side: "right" });
  w.pages.registerPage({
    ...w.pages.getPage("reader")!,
    id: "workspace",
    ref: viewerPage("workspace"),
    path: "workspace",
    panelView: undefined,
    params: { comparison: { type: "string", default: "fork_point", values: ["fork_point", "current", "provider"] } },
  });
  w.pageLocations.navigate({
    kind: "page",
    page: viewerPage("workspace"),
    resource: viewerResource("a"),
    params: { comparison: "current" },
  });
  w.movePanel(w.pages.getContent()!.widgetId, "side");
  const owner = w.layout.getActivePanel("side")!;
  const props = (region: "side" | "secondary") =>
    resolveWebviewPageProps(w.pages.store.getState(), w.layout.getLayout().regions[`${region}-right-menu`].widgets[0]);
  expect(props("side").pageParams?.comparison).toBe("current");
  w.pageLocations.navigate({
    kind: "page",
    page: viewerPage("workspace"),
    resource: viewerResource("b"),
    params: { comparison: "provider" },
  });
  expect(props("side").pageParams?.comparison).toBe("current");
  w.modePlacements.updatePlacement(owner.placementIdentity!, {
    location: { pageContext: { ...owner.pageContext!, params: { comparison: "fork_point" } } },
  });
  expect(props("side").pageParams?.comparison).toBe("fork_point");
  w.movePanel(owner.instanceId, "secondary");
  expect(props("secondary").pageParams?.comparison).toBe("fork_point");
  expect(props("secondary").pageLocation?.resource?.id).toBe("a");
  w.movePanel(w.pages.getContent()!.widgetId, "side");
  expect(props("secondary").pageParams?.comparison).toBe("fork_point");
  expect(props("side").pageParams?.comparison).toBe("provider");
  expect(props("side").pageLocation?.resource?.id).toBe("b");
});

for (const onward of [false, true])
  test(`a compound can return a dedicated page to its origin; onward=${onward}`, async () => {
    const { w, openMain } = createResourceViewerFixture();
    await openMain("a");
    const host = viewerHostKey(w, w.pages.getContent()!.widgetId);
    const targets = [
      {
        kind: "panel" as const,
        panel: viewerPanel,
        resource: viewerResource("a"),
        region: "side" as const,
        open: "pin" as const,
      },
      { kind: "page" as const, page: viewerPage("reader"), resource: viewerResource("a"), open: "pin" as const },
      ...(onward
        ? [
            {
              kind: "panel" as const,
              panel: viewerPanel,
              resource: viewerResource("a"),
              region: "secondary" as const,
              open: "pin" as const,
            },
          ]
        : []),
    ];
    await w.navigation.openTarget({ kind: "compound", targets });
    const final = onward ? w.layout.getActivePanel("secondary")! : w.pages.getContent()!;
    expect(final.resource?.id).toBe("a");
    expect(viewerHostKey(w, "instanceId" in final ? final.instanceId : final.widgetId)).toBe(host);
    expect(w.layout.listPanelInstances("side")).toHaveLength(0);
  });
