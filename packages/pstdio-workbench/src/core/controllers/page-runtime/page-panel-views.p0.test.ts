import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const fixture = (secondaryOpen = false) => {
  const w = createWorkbench({ defaultPanelOpenByRegionId: { secondary: secondaryOpen } });
  const page = { kind: "page" as const, extensionId: "example", id: "board" };
  w.modes.registerMode({ id: "project", activate() {} });
  for (const id of ["board", "other"])
    w.views.registerView({ id, title: id === "board" ? "Board" : id, body: { kind: "react", render: () => null } });
  const browser = { kind: "placement" as const, extensionId: "example", id: "board-browser" };
  w.modePlacements.registerPlacement({
    id: "example.placement.board-browser",
    ref: browser,
    modeId: "project",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "board" }, presence: "closed" },
  });
  w.pages.registerPage({
    id: "example.page.board",
    ref: page,
    title: "Board",
    path: "board",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "board" }, cardinality: "one", presentation: "page" },
    panelView: browser,
    slots: [],
  });
  const other = { kind: "page" as const, extensionId: "example", id: "other" };
  w.pages.registerPage({
    id: "other",
    ref: other,
    path: "other",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  w.pageLocations.setProject("project");
  w.pageLocations.navigate({ kind: "page", page });
  return { w, page, other };
};

test("a page can offer its renderer as an independent singleton panel view", async () => {
  const { w, other } = fixture();
  expect(w.composition.panelsFor("main").addable).toEqual([]);
  const card = w.composition.panelsFor("side").addable.find((panel) => panel.contribution.title === "Board");
  expect(card).toBeDefined();
  await card!.open?.();
  const panel = w.layout.getActivePanel("side")!;
  expect(panel.viewId).toBe("board");
  expect(panel.placementIdentity?.kind).toBe("mode");
  expect(w.pages.getContent()?.viewId).toBe("board");
  expect(w.composition.panelsFor("secondary").addable).toEqual([]);
  w.pageLocations.navigate({ kind: "page", page: other });
  expect(w.layout.getActivePanel("side")?.instanceId).toBe(panel.instanceId);
  w.movePanel(panel.instanceId, "secondary");
  expect(w.layout.getActivePanel("secondary")?.instanceId).toBe(panel.instanceId);
  w.closePlacement(panel.placementIdentity!);
  expect(w.composition.panelsFor("side").addable).toHaveLength(1);
});

test("a tabbed page landing selects its existing independent browser without moving it", async () => {
  const { w } = fixture();
  const panel = { kind: "placement" as const, extensionId: "example", id: "library" };
  w.modePlacements.registerPlacement({
    id: "example.placement.library",
    ref: panel,
    modeId: "project",
    region: "main",
    addableIn: ["main"],
    item: { kind: "view", view: { kind: "view", id: "other" }, presence: "closed" },
  });
  const library = { kind: "page" as const, extensionId: "example", id: "library" };
  w.pages.registerPage({
    id: "library",
    ref: library,
    path: "library",
    modeId: "project",
    main: { kind: "panels", landing: panel },
    panelView: panel,
    slots: [],
  });
  const result = w.pageLocations.navigate({ kind: "page", page: library });
  expect(result.ok).toBe(true);
  const browser = w.layout.getActivePanel("main")!;
  expect(browser?.viewId).toBe("other");
  w.movePanel(browser.instanceId, "side");
  w.pageLocations.navigate({ kind: "page", page: library });
  expect(w.layout.getActivePanel("side")?.instanceId).toBe(browser.instanceId);
  expect(w.layout.getLayout().regions.main.widgets).toEqual([]);
  expect(w.composition.panelsFor("main").addable.some((entry) => entry.panelId === browser.panelId)).toBe(false);
});

for (const method of ["direct", "compound"] as const)
  test(`${method} page navigation rejects a denied landing before changing owners`, async () => {
    const { w } = fixture();
    w.modes.registerMode({ id: "locked", activate() {}, regionSettings: { secondary: { canOpen: false } } });
    const panel = { kind: "placement" as const, extensionId: "example", id: "locked-library" };
    w.modePlacements.registerPlacement({
      id: "locked-library",
      ref: panel,
      modeId: "locked",
      region: "secondary",
      item: { kind: "view", view: { kind: "view", id: "other" }, presence: "closed" },
    });
    const page = { kind: "page" as const, extensionId: "example", id: "locked-library" };
    w.pages.registerPage({
      id: "locked-library",
      ref: page,
      path: "locked",
      modeId: "locked",
      main: { kind: "panels", landing: panel },
      slots: [],
    });
    w.shell.setRegionOpen("secondary", false);
    const location = w.pages.store.getState().location;
    const layout = w.layout.getLayout();
    if (method === "direct") expect(w.pageLocations.navigate({ kind: "page", page }).ok).toBe(false);
    else
      await expect(w.navigation.openTarget({ kind: "compound", targets: [{ kind: "page", page }] })).rejects.toThrow();
    expect(w.pages.store.getState().location).toBe(location);
    expect(w.layout.getLayout()).toBe(layout);
    expect(w.modePlacements.resolvePlacements("locked")).toEqual([]);
  });

for (const method of ["direct", "compound"] as const)
  test(`${method} page navigation can select a landing in an already visible panel`, async () => {
    const { w } = fixture(true);
    w.modes.registerMode({ id: "locked", activate() {}, regionSettings: { secondary: { canOpen: false } } });
    const panel = { kind: "placement" as const, extensionId: "example", id: "visible-library" };
    w.modePlacements.registerPlacement({
      id: "visible-library",
      ref: panel,
      modeId: "locked",
      region: "secondary",
      item: { kind: "view", view: { kind: "view", id: "other" }, presence: "closed" },
    });
    const page = { kind: "page" as const, extensionId: "example", id: "visible-library" };
    w.pages.registerPage({
      id: "visible-library",
      ref: page,
      path: "visible",
      modeId: "locked",
      main: { kind: "panels", landing: panel },
      slots: [],
    });
    if (method === "direct") expect(w.pageLocations.navigate({ kind: "page", page }).ok).toBe(true);
    else await w.navigation.openTarget({ kind: "compound", targets: [{ kind: "page", page }] });
    expect(w.layout.getActivePanel("secondary")?.viewId).toBe("other");
  });
