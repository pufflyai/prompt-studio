import { expect, test } from "bun:test";
import type { PageRef } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";

test.each([
  false,
  true,
])("first mode entry opens fixed panels with adopted host panel %p and restores a later hide", (adoptHost) => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const workbench = createWorkbench({
    defaultPanelOpenByRegionId: { secondary: false },
    layoutPersistence: {
      getLayout: (scope) => layouts.get(scope),
      setLayout: (layout, scope) => layouts.set(scope, layout),
    },
  });
  workbench.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.modes.registerMode({ id: "boombox", activate: () => undefined });
  workbench.modePlacements.registerPlacement({
    id: "player",
    ref: { extensionId: "test", kind: "placement", id: "player" },
    modeId: "boombox",
    region: "secondary",
    item: { kind: "view", view: { kind: "view", id: "content" }, presence: "fixed" },
  });
  const page = (id: string): PageRef => ({ kind: "page", extensionId: "test", id });
  for (const modeId of ["project", "boombox"]) {
    workbench.pages.registerPage({
      id: modeId,
      ref: page(modeId),
      path: modeId,
      modeId,
      main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
      slots: [],
    });
  }
  workbench.pageLocations.setProject("p1");
  if (adoptHost) {
    workbench.layout.registerWidget({ id: "host", title: "Host", region: "side", rendererId: "host" });
    workbench.layout.openWidget("host", { role: "sub-panel" });
    workbench.layout.registerWidget({ id: "second", title: "Second", region: "side", rendererId: "host" });
    workbench.layout.openWidget("second", { role: "sub-panel" });
    workbench.sidePanel.setMode("closed");
  }
  const selected = workbench.layout.getLayout().regions.side.activeWidgetId;
  expect(workbench.pageLocations.navigate({ kind: "page", page: page("boombox") }).ok).toBe(true);
  expect(workbench.layout.getLayout().regions.secondary.widgets).toHaveLength(1);
  expect(workbench.shell.getRegionState("secondary").open).toBe(true);
  if (adoptHost) {
    expect(workbench.layout.getLayout().regions.side.widgets[0]!.placementIdentity?.kind).toBe("mode");
    expect(workbench.sidePanel.getMode()).toBe("closed");
    expect(workbench.layout.getLayout().regions.side.activeWidgetId).toBe(selected);
  }
  workbench.shell.setRegionOpen("secondary", false);
  workbench.pageLocations.navigate({ kind: "page", page: page("project") });
  workbench.pageLocations.navigate({ kind: "page", page: page("boombox") });
  expect(workbench.shell.getRegionState("secondary").open).toBe(false);
});

test("first mode page keeps a closed empty Side Panel attached when it is later revealed", () => {
  const workbench = createWorkbench();
  workbench.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  const page: PageRef = { kind: "page", extensionId: "test", id: "home" };
  workbench.pages.registerPage({
    id: "home",
    ref: page,
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.setProject("p1");
  workbench.sidePanel.setMode("attached");
  workbench.sidePanel.setMode("closed");
  workbench.pageLocations.navigate({ kind: "page", page });
  expect(workbench.sidePanel.getMode()).toBe("closed");
  workbench.shell.setRegionOpen("side", true);
  expect(workbench.sidePanel.getMode()).toBe("attached");
});

test.each([false, true])("first mode entry keeps unavailable panels closed with adopted host panel %p", (adoptHost) => {
  const workbench = createWorkbench();
  workbench.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  workbench.modes.registerMode({ id: "main-only", panels: ["main"], activate: () => undefined });
  const page: PageRef = { kind: "page", extensionId: "test", id: "home" };
  workbench.pages.registerPage({
    id: "home",
    ref: page,
    path: "home",
    modeId: "main-only",
    main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.setProject("p1");
  if (adoptHost) {
    workbench.layout.registerWidget({ id: "host", title: "Host", region: "side", rendererId: "host" });
    workbench.layout.openWidget("host", { role: "sub-panel" });
  }
  workbench.sidePanel.setMode("attached");
  workbench.pageLocations.navigate({ kind: "page", page });
  expect(workbench.shell.getRegionState("side").open).toBe(false);
  expect(workbench.shell.getRegionState("secondary").open).toBe(false);
  expect(workbench.sidePanel.getMode()).toBe("closed");
});
