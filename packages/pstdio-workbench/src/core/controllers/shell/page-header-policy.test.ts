import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("page headers follow the page tab policy across navigation and saved header choices", () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "project", activate() {}, regionSettings: { main: { showHeader: false } } });
  w.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  for (const presentation of ["page", "tabs"] as const) {
    w.pages.registerPage({
      id: presentation,
      ref: { kind: "page", extensionId: "test", id: presentation },
      title: presentation,
      path: presentation,
      modeId: "project",
      main: { kind: "view", presentation, view: { kind: "view", id: "content" }, cardinality: "one" },
      slots: [],
    });
  }
  w.pageLocations.setProject("project-1");
  for (const presentation of ["page", "tabs", "page", "tabs"] as const) {
    w.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "test", id: presentation } });
    w.shell.setHeaderVisible("main", presentation === "page");
    expect(w.shell.getPanelPolicy("main")).toMatchObject({
      acceptsTabs: presentation === "tabs",
      showHeader: presentation === "tabs",
    });
  }
});

test("a tabbed page keeps its header when adding more tabs is disabled", () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "project", activate() {}, regionSettings: { main: { acceptsTabs: false } } });
  const page = { kind: "page", extensionId: "test", id: "collection" } as const;
  w.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Collection",
    path: "collection",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  w.pageLocations.setProject("project-1");
  w.pageLocations.navigate({ kind: "page", page });
  expect(w.shell.getPanelPolicy("main")).toMatchObject({ acceptsTabs: false, showHeader: true });
});

test("deprecated alwaysShowTabs false still hides a tabbed page's Main header", () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "project", activate() {}, regionSettings: { main: { alwaysShowTabs: false } } });
  w.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  const page = { kind: "page", extensionId: "test", id: "record" } as const;
  w.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Record",
    path: "record",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
    slots: [],
  });
  w.pageLocations.setProject("project-1");
  w.pageLocations.navigate({ kind: "page", page });
  expect(w.shell.getPanelPolicy("main")).toMatchObject({ acceptsTabs: true, showHeader: false });
});
