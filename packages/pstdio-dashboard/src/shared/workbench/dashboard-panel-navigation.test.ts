import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchLayout } from "@pstdio/workbench";
import { createWorkbenchTerminalModule, openWorkbenchTerminal } from "@pstdio/workbench/react";
import { resolveDashboardPersistenceScope } from "./dashboard-persistence-scope";

const setup = () => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const workbench = createWorkbench({
    initialSidePanelMode: "closed",
    defaultPanelOpenByRegionId: { secondary: false },
    layoutPersistence: {
      getLayout: (scope) => layouts.get(scope),
      setLayout: (layout, scope) => layouts.set(scope, structuredClone(layout)),
    },
    resolvePagePersistenceScope: resolveDashboardPersistenceScope,
  });
  workbench.modes.registerMode({ id: "project", panels: ["main", "side", "secondary"], activate() {} });
  workbench.modes.registerMode({ id: "other", panels: ["main", "side", "secondary"], activate() {} });
  workbench.views.registerView({ id: "document", title: "Document", body: { kind: "react", render: () => null } });
  for (const id of ["workspace", "ticket", "tickets", "other"])
    workbench.pages.registerPage({
      id,
      ref: { kind: "page", id, extensionId: "test" },
      modeId: id === "other" ? "other" : "project",
      path: id,
      main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
      slots: [],
    });
  const navigate = (id: string) =>
    workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id, extensionId: "test" } });
  workbench.pageLocations.setProject("project");
  navigate("workspace");
  return { workbench, navigate };
};

test.each(["side", "secondary"] as const)("a manually opened %s panel stays open across pages", (region) => {
  const { workbench, navigate } = setup();
  workbench.shell.setRegionOpen(region, true);
  for (const page of ["ticket", "tickets", "workspace"]) {
    navigate(page);
    expect(workbench.shell.getRegionState(region).open).toBe(true);
  }
});

test("a manually added terminal stays open across workspace, ticket and tickets pages", () => {
  const { workbench, navigate } = setup();
  workbench.registerModule(createWorkbenchTerminalModule());
  const terminal = openWorkbenchTerminal(workbench);
  for (const page of ["ticket", "tickets", "workspace"]) {
    navigate(page);
    expect(workbench.layout.getActivePanel("secondary")?.instanceId).toBe(terminal.instanceId);
    expect(workbench.shell.getRegionState("secondary").open).toBe(true);
  }
});

test("browser Back keeps a terminal added after entering the workspace", () => {
  const { workbench, navigate } = setup();
  workbench.registerModule(createWorkbenchTerminalModule());
  navigate("ticket");
  navigate("workspace");
  const terminal = openWorkbenchTerminal(workbench);
  workbench.pageLocations.goBack();
  expect(workbench.pages.store.getState().activePageId).toBe("ticket");
  expect(workbench.layout.getActivePanel("secondary")?.instanceId).toBe(terminal.instanceId);
  navigate("tickets");
  expect(workbench.layout.getActivePanel("secondary")?.instanceId).toBe(terminal.instanceId);
});

test.each([
  "side",
  "secondary",
] as const)("manual %s tabs keep their tray and do not return after closing", (region) => {
  const { workbench, navigate } = setup();
  workbench.shellPlacements.registerPlacement({
    id: "manual",
    region,
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "document" }],
        cardinality: "many",
      },
    },
  });
  const identity = workbench.shellPlacements.openPlacement({
    placementId: "manual",
    resource: { type: "document", id: "manual" },
    open: "pin",
  });
  workbench.shell.setRegionOpen(region, true);
  const tab = workbench.layout.getActivePanel(region)!;
  navigate("ticket");
  expect(workbench.layout.getActivePanel(region)?.instanceId).toBe(tab.instanceId);
  workbench.closePlacement(identity);
  navigate("workspace");
  expect(workbench.layout.listPanelInstances(region)).toEqual([]);
  expect(workbench.shell.getRegionState(region).open).toBe(false);
});

test("moving a final document preview carries its tab into the parent collection", () => {
  const { workbench: w } = setup();
  w.pages.registerPage({
    id: "preview",
    ref: { kind: "page", extensionId: "test", id: "preview" },
    path: "preview",
    modeId: "project",
    parentId: "workspace",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    document: { metadataKey: "document" },
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "many" },
    slots: [],
  });
  const target = {
    kind: "page" as const,
    page: { kind: "page" as const, extensionId: "test", id: "preview" },
    resource: { type: "document", id: "layout", metadata: { document: "a" } },
    open: "preview" as const,
  };
  w.pageLocations.navigate(target);
  w.pageLocations.navigate({ ...target, resource: { ...target.resource, metadata: { document: "b" } } });
  w.pageLocations.navigate(target);
  const editor = w.layout.getActivePanel("main")!;
  w.movePanel(editor.instanceId, "side");
  expect(w.shell.getRegionState("side").open).toBe(true);
  expect(w.pages.store.getState().activePageId).toBe("workspace");
  expect(w.layout.getActivePanel("side")).toMatchObject({ instanceId: editor.instanceId, tabRetention: "persistent" });
});
