import { expect, test } from "bun:test";
import type { ModeRef, PageRef } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../workbench-core";
import { createMemoryWorkbenchPageLocationBrowser } from "./page-location-memory";
import type { WorkbenchPageLocationPersistence } from "./page-location-types";

const mode = (id: string): ModeRef => ({ kind: "mode", id });
const ref = (id: string): PageRef => ({ kind: "page", extensionId: "test", id });
const harness = (
  persistence?: WorkbenchPageLocationPersistence,
  layouts = new Map<string | undefined, import("../../registries/layout/layout-types").WorkbenchLayout>(),
) => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const workbench = createWorkbench({
    startPage: ref("home"),
    pageLocationBrowser: browser,
    pageLocationPersistence: persistence,
    layoutPersistence: {
      getLayout: (scope) => layouts.get(scope),
      setLayout: (layout, scope) => {
        layouts.set(scope, structuredClone(layout));
      },
    },
  });
  workbench.views.registerView({ id: "empty", title: "Empty", body: { kind: "react", render: () => null } });
  for (const id of ["project", "boombox", "kiln"])
    workbench.modes.registerMode({ id, basePage: ref("home"), activate: () => undefined });
  for (const [id, modeIds] of [
    ["home", ["project", "boombox", "kiln"]],
    ["music", ["boombox"]],
  ] as const)
    workbench.pages.registerPage({
      id,
      ref: ref(id),
      path: id,
      modeId: modeIds[0],
      modeIds,
      main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
      slots: [],
    });
  workbench.pageLocations.switchProject("p1");
  return { workbench, browser };
};

test("rejects explicitly unsupported modes without changing stores or history", async () => {
  const { workbench, browser } = harness();
  const before = workbench.pages.store.getState();
  const entry = browser.current();
  expect(workbench.pageLocations.navigate({ kind: "page", page: ref("music"), mode: mode("project") }).ok).toBe(false);
  expect(workbench.pages.store.getState()).toBe(before);
  expect(browser.current()).toBe(entry);
  let failure: unknown;
  try {
    await workbench.navigation.openTarget({
      kind: "compound",
      targets: [
        { kind: "page", page: ref("home"), mode: mode("kiln") },
        { kind: "page", page: ref("music"), mode: mode("kiln") },
      ],
    });
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(workbench.pages.store.getState()).toBe(before);
  expect(workbench.modes.getActiveModeId()).toBe("project");
  expect(browser.current()).toBe(entry);
});

test("ordinary opens keep a supported current mode or switch to the page default", () => {
  const { workbench } = harness();
  workbench.modes.setActiveMode("kiln");
  expect(workbench.pageLocations.navigate({ kind: "page", page: ref("home") }).ok).toBe(true);
  expect(workbench.modes.getActiveModeId()).toBe("kiln");
  expect(workbench.pageLocations.navigate({ kind: "page", page: ref("music") }).ok).toBe(true);
  expect(workbench.modes.getActiveModeId()).toBe("boombox");
  expect(workbench.pages.store.getState().location?.mode?.id).toBe("boombox");
});

test("ordinary compound navigation chooses a supported mode for each page", async () => {
  const { workbench } = harness();
  await workbench.navigation.openTarget({
    kind: "compound",
    targets: [
      { kind: "page", page: ref("home"), mode: mode("kiln") },
      { kind: "page", page: ref("music") },
    ],
  });
  expect(workbench.pages.store.getState().activePageId).toBe("music");
  expect(workbench.modes.getActiveModeId()).toBe("boombox");
});

test("a copied URL without a mode opens in the page default when the current mode is unsupported", () => {
  const { workbench, browser } = harness();
  browser.replace({ url: "/projects/p1/extensions/test/music" });
  expect(workbench.pageLocations.boot("p1").ok).toBe(true);
  expect(workbench.pages.store.getState().activePageId).toBe("music");
  expect(workbench.modes.getActiveModeId()).toBe("boombox");
});

test("reselecting a mode reconciles the current page without adding history", () => {
  const { workbench, browser } = harness();
  const entry = browser.current();
  workbench.modes.setActiveMode("project");
  expect(browser.current()).toBe(entry);
  expect(workbench.pageLocations.historyStore.getState().canGoBack).toBe(false);
  expect(workbench.pageLocations.switchMode("project").ok).toBe(true);
  expect(browser.current()).toBe(entry);
  expect(workbench.pageLocations.historyStore.getState().canGoBack).toBe(false);
});

test.each(["session", "workspace"])("removed %s resources cannot return through remembered mode pages", (type) => {
  let saved: ReturnType<WorkbenchPageLocationPersistence["load"]>;
  const persistence: WorkbenchPageLocationPersistence = {
    load: () => saved,
    save: (_projectId, value) => {
      saved = value;
    },
  };
  const register = (workbench: ReturnType<typeof createWorkbench>) => {
    for (const [id, parentId] of [
      ["workspace", "home"],
      ["session", "workspace"],
    ])
      workbench.pages.registerPage({
        id,
        ref: ref(id),
        path: id,
        parentId,
        modeId: "boombox",
        modeIds: ["boombox"],
        resource: { kinds: [{ kind: "resource-kind", id }] },
        main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "many" },
        slots: [],
      });
  };
  const { workbench } = harness(persistence);
  register(workbench);
  workbench.modes.setActiveMode("boombox");
  expect(
    workbench.pageLocations.navigate({
      kind: "page",
      page: ref("session"),
      resource: { type: "session", id: "s1", projectId: "p1" },
      parent: { kind: "page", page: ref("workspace"), resource: { type: "workspace", id: "w1", projectId: "p1" } },
    }).ok,
  ).toBe(true);
  workbench.modes.setActiveMode("project");
  workbench.resources.removed({ type, id: type === "session" ? "s1" : "w1", projectId: "p1", label: "Renamed" });
  expect(saved?.modeLocations?.boombox).toBeUndefined();
  workbench.modes.setActiveMode("boombox");
  expect(workbench.pages.store.getState().activePageId).toBe("home");
  const reloaded = harness(persistence).workbench;
  register(reloaded);
  reloaded.modes.setActiveMode("boombox");
  expect(reloaded.pages.store.getState().activePageId).toBe("home");
});

test("history and copied URLs restore the mode in which a shared page was shown", () => {
  const { workbench, browser } = harness();
  workbench.pageLocations.navigate({ kind: "page", page: ref("home"), mode: mode("boombox") });
  const copied = browser.current().url;
  expect(new URL(copied, "http://test").searchParams.get("_mode")).toBe("boombox");
  workbench.pageLocations.navigate({ kind: "page", page: ref("home"), mode: mode("kiln") });
  workbench.pageLocations.goBack();
  expect(workbench.modes.getActiveModeId()).toBe("boombox");
  workbench.pageLocations.goForward();
  expect(workbench.modes.getActiveModeId()).toBe("kiln");
  browser.replace({ url: copied });
  workbench.pageLocations.boot("p1");
  expect(workbench.modes.getActiveModeId()).toBe("boombox");
});

test("mode switches restore their last allowed page or their base page", () => {
  const { workbench } = harness();
  workbench.modes.setActiveMode("boombox");
  expect(workbench.pages.store.getState().activeModeId).toBe("boombox");
  workbench.pageLocations.navigate({ kind: "page", page: ref("music") });
  workbench.modes.setActiveMode("kiln");
  expect(workbench.pages.store.getState().activePageId).toBe("home");
  workbench.modes.setActiveMode("boombox");
  expect(workbench.pages.store.getState().activePageId).toBe("music");
});

test("returning to a shared page in another mode restores its Main content", () => {
  const { workbench } = harness();
  const original = workbench.layout.getActivePanel("main")!;
  expect(original).toBeDefined();
  workbench.modes.setActiveMode("boombox");
  expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
  workbench.modes.setActiveMode("project");
  expect(workbench.pages.store.getState().activePageId).toBe("home");
  expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
});

test("legacy singleton pages still switch to their declared mode", () => {
  const { workbench } = harness();
  workbench.pages.registerPage({
    id: "legacy",
    ref: ref("legacy"),
    path: "legacy",
    modeId: "kiln",
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  expect(workbench.pageLocations.navigate({ kind: "page", page: ref("legacy") }).ok).toBe(true);
  expect(workbench.modes.getActiveModeId()).toBe("kiln");
});

test("unavailable mode URLs and history entries leave the current page and mode intact", () => {
  const { workbench, browser } = harness();
  const before = workbench.pages.store.getState();
  browser.replace({ url: "/projects/p1/extensions/test/music?_mode=kiln" });
  expect(workbench.pageLocations.boot("p1").ok).toBe(false);
  expect(workbench.pages.store.getState()).toBe(before);
  expect(workbench.pageLocations.replay({ page: ref("music"), mode: mode("kiln") }).ok).toBe(false);
  expect(workbench.pages.store.getState()).toBe(before);
  expect(workbench.modes.getActiveModeId()).toBe("project");
});

test("mode base pages pass the same availability check before mode changes", () => {
  const { workbench } = harness();
  workbench.modes.registerMode({ id: "wrong", basePage: ref("music"), activate: () => undefined });
  const before = workbench.pages.store.getState();
  expect(() => workbench.modes.setActiveMode("wrong")).toThrow("unavailable");
  expect(workbench.pages.store.getState()).toBe(before);
  expect(workbench.modes.getActiveModeId()).toBe("project");
});

test("navigation links can switch modes while page discovery lists the current mode", async () => {
  const { workbench } = harness();
  const owner = { kind: "mode" as const, extensionId: "test", id: "project" };
  workbench.navigationTrees.registerContribution({
    id: "pages",
    owner,
    sourceExtensionId: "test",
    declarationIndex: 0,
    getSections: () => [
      {
        id: "pages",
        nodes: [
          ...["home", "music"].map((id) => ({ id, label: id, target: { kind: "page" as const, page: ref(id) } })),
          {
            id: "invalid",
            label: "Invalid",
            target: { kind: "page" as const, page: ref("music"), mode: mode("project") },
          },
        ],
      },
    ],
  });
  expect((await workbench.navigationTrees.getSections(owner))[0]?.nodes.map((node) => node.id)).toEqual([
    "home",
    "music",
  ]);
  expect(workbench.pages.listAvailablePages("project").map((page) => page.id)).toEqual(["home"]);
  workbench.modes.setActiveMode("boombox");
  expect((await workbench.navigationTrees.getSections(owner))[0]?.nodes.map((node) => node.id)).toEqual([
    "home",
    "music",
  ]);
});

test("retargeting a shared page preserves its captured parent and each location's mode", () => {
  const { workbench } = harness();
  workbench.pages.registerPage({
    id: "document",
    ref: ref("document"),
    path: "document",
    parentId: "home",
    modeId: "project",
    modeIds: ["project", "boombox"],
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "many" },
    slots: [],
  });
  const resource = { type: "file", id: "one" };
  expect(
    workbench.pageLocations.navigate({
      kind: "page",
      page: ref("document"),
      resource,
      mode: mode("boombox"),
      parent: { kind: "page", page: ref("home"), mode: mode("project") },
    }).ok,
  ).toBe(true);
  expect(
    workbench.pageLocations.navigate({
      kind: "page",
      page: ref("document"),
      resource: { ...resource, label: "Renamed" },
    }).ok,
  ).toBe(true);
  const location = workbench.pages.store.getState().location;
  expect(location?.mode?.id).toBe("boombox");
  expect(location?.parent?.mode?.id).toBe("project");
});

test("a mode without a base page restores its allowed remembered page", () => {
  const { workbench } = harness();
  workbench.modes.registerMode({ id: "temporary", activate() {} });
  workbench.pages.registerPage({
    id: "temporary",
    ref: ref("temporary"),
    path: "temporary",
    modeId: "temporary",
    modeIds: ["temporary"],
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.navigate({ kind: "page", page: ref("temporary"), mode: mode("temporary") });
  workbench.modes.setActiveMode("project");
  workbench.modes.setActiveMode("temporary");
  expect(workbench.pages.store.getState().activePageId).toBe("temporary");
  expect(workbench.pages.store.getState().activeModeId).toBe("temporary");
});

test("switching to a mode without an allowed last page or fallback leaves restricted navigation unchanged", () => {
  const { workbench, browser } = harness();
  workbench.modes.registerMode({ id: "unavailable", activate() {} });
  const state = workbench.pages.store.getState();
  const entry = browser.current();
  expect(() => workbench.modes.setActiveMode("unavailable")).toThrow();
  expect(workbench.pages.store.getState()).toBe(state);
  expect(workbench.modes.getActiveModeId()).toBe("project");
  expect(browser.current()).toBe(entry);
});

test("reload keeps the captured mode when it restores a saved Main layout", async () => {
  const { createMemoryWorkbenchPageLocationPersistence } = await import("./page-location-memory");
  const persistence = createMemoryWorkbenchPageLocationPersistence();
  const layouts = new Map();
  const first = harness(persistence, layouts).workbench;
  first.pageLocations.navigate({ kind: "page", page: ref("home"), mode: mode("boombox") });
  const reloaded = harness(persistence, layouts).workbench;
  expect(reloaded.pages.store.getState().activeModeId).toBe("boombox");
  expect(reloaded.modes.getActiveModeId()).toBe("boombox");
});
