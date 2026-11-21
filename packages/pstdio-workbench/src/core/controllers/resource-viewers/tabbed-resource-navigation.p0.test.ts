import { expect, test } from "bun:test";
import { createMemoryWorkbenchPageLocationBrowser } from "../page-location/page-location-memory";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";
import { viewerHostKey } from "./viewer-host-continuity";

const target = (id: string, page = "reader") => ({
  kind: "page" as const,
  page: viewerPage(page),
  resource: viewerResource(id),
  open: "pin" as const,
});

test("resource opens add and reuse tabs in the current container without changing its route", async () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const { w } = createResourceViewerFixture({ browser });
  const location = w.pages.store.getState().location;
  const url = browser.current().url;
  await w.navigation.openTarget(target("a"));
  await w.navigation.openTarget(target("b"));
  const order = w.layout.listPanelInstances("main").map((panel) => panel.instanceId);
  await w.navigation.openTarget(target("a"));
  expect(w.pages.store.getState().location).toEqual(location);
  expect(browser.current().url).toBe(url);
  expect(w.layout.listPanelInstances("main").map((panel) => panel.instanceId)).toEqual(order);
  expect(w.layout.listPanelInstances("main").map((panel) => panel.resource?.id)).toEqual(["a", "b"]);
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("a");
  expect(w.layout.getActivePanel("main")?.pageContext?.page).toEqual(viewerPage("reader"));
});

test("ordinary resource tabs preserve default preview and explicit pin intent", async () => {
  const { w } = createResourceViewerFixture();
  const { open: _open, ...ordinary } = target("a");
  await w.navigation.openTarget(ordinary);
  expect(w.pages.store.getState().activePageId).toBe("home");
  expect(w.layout.getActivePanel("main")?.tabRetention).toBe("preview");
  await w.navigation.openTarget(target("a"));
  await w.navigation.openTarget({ ...target("b"), open: "preview" });
  const tabs = w.layout.listPanelInstances("main");
  expect(tabs).toHaveLength(2);
  expect(tabs.find((tab) => tab.resource?.id === "a")?.tabRetention).toBe("persistent");
  expect(tabs.find((tab) => tab.resource?.id === "b")?.tabRetention).toBe("preview");
});

test("opening an existing Side resource in a tabbed page preserves its live host in a Main tab", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("a");
  const host = viewerHostKey(w, side().instanceId);
  await w.navigation.openPage(target("a"));
  expect(w.pages.store.getState().activePageId).toBe("home");
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
  const tab = w.layout.getActivePanel("main")!;
  expect(tab.resource?.id).toBe("a");
  expect(viewerHostKey(w, tab.instanceId)).toBe(host);
});

test("a resource tab without a public panel retains and refreshes its page parameters", async () => {
  const { w } = createResourceViewerFixture();
  w.pages.registerPage({
    ...w.pages.getPage("reader")!,
    id: "portable",
    ref: viewerPage("portable"),
    path: "portable",
    panelView: undefined,
    params: { comparison: { type: "string", values: ["current", "provider"] } },
  });
  await w.navigation.openTarget({ ...target("a", "portable"), params: { comparison: "current" } });
  const first = w.layout.getActivePanel("main")!;
  await w.navigation.openTarget({ ...target("a", "portable"), params: { comparison: "provider" } });
  expect(w.pages.store.getState().activePageId).toBe("home");
  expect(w.layout.listPanelInstances("main")).toHaveLength(1);
  expect(w.layout.getActivePanel("main")?.instanceId).toBe(first.instanceId);
  expect(w.layout.getActivePanel("main")?.pageContext?.params).toEqual({ comparison: "provider" });
});

test("a normal resource open from a dedicated page uses a dedicated resource page", async () => {
  const { w, other } = createResourceViewerFixture();
  other();
  await w.navigation.openTarget(target("a"));
  expect(w.pages.getContent()?.resource?.id).toBe("a");
  expect(w.pages.store.getState().activePageId).toBe("reader");
});

test("explicit page-location navigation keeps its full-page meaning from a tabbed container", () => {
  const { w } = createResourceViewerFixture();
  expect(w.pageLocations.navigate(target("a")).ok).toBe(true);
  expect(w.pages.getContent()?.resource?.id).toBe("a");
  w.pageLocations.goBack();
  expect(w.pages.store.getState().activePageId).toBe("home");
});

test("compound resource opens use the container produced by preceding operations", async () => {
  const { w } = createResourceViewerFixture();
  await w.navigation.openTarget({ kind: "compound", targets: [target("a"), target("b")] });
  expect(w.pages.store.getState().activePageId).toBe("home");
  expect(w.layout.listPanelInstances("main").map((panel) => panel.resource?.id)).toEqual(["a", "b"]);
  await w.navigation.openTarget({
    kind: "compound",
    targets: [{ kind: "page", page: viewerPage("other") }, target("c")],
  });
  expect(w.pages.store.getState().activePageId).toBe("reader");
  expect(w.pages.getContent()?.resource?.id).toBe("c");
  await w.navigation.openTarget({
    kind: "compound",
    targets: [{ kind: "page", page: viewerPage("home") }, target("d")],
  });
  expect(w.pages.store.getState().activePageId).toBe("home");
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("d");
});

test("foreign resource tabs keep a resource container's route through selection and reload", async () => {
  const registerPages = (w: ReturnType<typeof createResourceViewerFixture>["w"]) =>
    w.pages.registerPage({
      ...w.pages.getPage("reader")!,
      id: "foreign",
      ref: viewerPage("foreign"),
      path: "foreign",
      panelView: undefined,
      main: { kind: "view", view: { kind: "view", id: "reader" }, cardinality: "one", presentation: "page" },
    });
  const s = createResourceViewerFixture({ collection: true, registerPages });
  s.w.pageLocations.navigate(target("a"));
  const location = s.w.pages.store.getState().location;
  await s.w.navigation.openTarget(target("b", "foreign"));
  expect(s.w.pages.store.getState().location).toEqual(location);
  const [landing, foreign] = s.w.layout.listPanelInstances("main");
  s.w.layout.activatePanel(landing!.instanceId);
  s.w.layout.activatePanel(foreign!.instanceId);
  expect(s.w.pages.store.getState().location).toEqual(location);
  const restored = createResourceViewerFixture({
    collection: true,
    registerPages,
    saved: s.saved,
    locations: s.locations,
    boot: true,
  }).w;
  expect(restored.pages.store.getState().location).toEqual(location);
  expect(restored.layout.getActivePanel("main")?.resource?.id).toBe("b");
  const [restoredLanding, restoredForeign] = restored.layout.listPanelInstances("main");
  restored.layout.activatePanel(restoredLanding!.instanceId);
  restored.layout.activatePanel(restoredForeign!.instanceId);
  expect(restored.pages.store.getState().location).toEqual(location);
});

test("a resource renderer with its own tab presentation can open in the current container", async () => {
  const { w } = createResourceViewerFixture();
  w.pages.registerPage({
    ...w.pages.getPage("reader")!,
    id: "tabbed-reader",
    ref: viewerPage("tabbed-reader"),
    path: "tabbed-reader",
    panelView: undefined,
    main: { kind: "view", view: { kind: "view", id: "reader" }, cardinality: "many", presentation: "tabs" },
  });
  await w.navigation.openTarget(target("a", "tabbed-reader"));
  expect(w.pages.store.getState().activePageId).toBe("home");
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("a");
});

test("a tabbed resource page keeps its own resource routing when its tabs change", async () => {
  const { w } = createResourceViewerFixture({ tabs: true });
  w.pageLocations.navigate(target("a"));
  const first = w.layout.getActivePanel("main")!;
  await w.navigation.openTarget(target("b"));
  expect(w.pages.store.getState().location?.resource?.id).toBe("b");
  w.layout.activatePanel(first.instanceId);
  expect(w.pages.store.getState().location?.resource?.id).toBe("a");
  expect(w.layout.listPanelInstances("main")).toHaveLength(2);
});

for (const main of ["view", "landing"] as const)
  test(`a resource page with a ${main} and another Main view opens its whole page`, async () => {
    const { w } = createResourceViewerFixture();
    const landing = { kind: "placement" as const, extensionId: "example.readers", id: "landing" };
    w.modePlacements.registerPlacement({
      id: "landing",
      ref: landing,
      modeId: "project",
      region: "main",
      item: {
        kind: "binding",
        binding: {
          ...w.pages.getPage("reader")!.resource!,
          view: { kind: "view", id: "reader" },
          cardinality: "many",
        },
      },
    });
    w.pages.registerPage({
      ...w.pages.getPage("reader")!,
      id: "multiple",
      ref: viewerPage("multiple"),
      path: "multiple",
      main:
        main === "landing"
          ? { kind: "panels", landing }
          : { kind: "view", view: { kind: "view", id: "reader" }, cardinality: "many", presentation: "tabs" },
      slots: [
        {
          id: "details",
          region: "main",
          item: { kind: "view", view: { kind: "view", id: "browser" }, presence: "open" },
        },
      ],
    });
    await w.navigation.openTarget(target("a", "multiple"));
    expect(w.pages.store.getState().activePageId).toBe("multiple");
    expect(w.layout.listPanelInstances("main")).toHaveLength(2);
  });

test("a resource page with a static landing keeps its full page destination", async () => {
  const { w } = createResourceViewerFixture();
  const landing = { kind: "placement" as const, extensionId: "example.readers", id: "static" };
  w.modePlacements.registerPlacement({
    id: "static",
    ref: landing,
    modeId: "project",
    region: "main",
    item: { kind: "view", view: { kind: "view", id: "browser" }, presence: "closed" },
  });
  w.pages.registerPage({
    ...w.pages.getPage("reader")!,
    id: "static",
    ref: viewerPage("static"),
    path: "static",
    main: { kind: "panels", landing },
  });
  const { open: _open, ...page } = target("a", "static");
  await w.navigation.openTarget(page);
  expect(w.pages.store.getState().activePageId).toBe("static");
  expect(w.pages.store.getState().location?.resource?.id).toBe("a");
  expect(w.layout.getActivePanel("main")?.viewId).toBe("browser");
});

test("a resource page with one binding landing opens as a tab in the receiving container", async () => {
  const { w } = createResourceViewerFixture();
  const landing = { kind: "placement" as const, extensionId: "example.readers", id: "landing" };
  w.modePlacements.registerPlacement({
    id: "landing",
    ref: landing,
    modeId: "project",
    region: "main",
    item: {
      kind: "binding",
      binding: {
        ...w.pages.getPage("reader")!.resource!,
        view: { kind: "view", id: "reader" },
        cardinality: "many",
      },
    },
  });
  w.pages.registerPage({
    ...w.pages.getPage("reader")!,
    id: "landing",
    ref: viewerPage("landing"),
    path: "landing",
    main: { kind: "panels", landing },
  });
  await w.navigation.openTarget(target("a", "landing"));
  expect(w.pages.store.getState().activePageId).toBe("home");
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("a");
  expect(w.layout.getActivePanel("main")?.pageContext?.page).toEqual(viewerPage("landing"));
});
