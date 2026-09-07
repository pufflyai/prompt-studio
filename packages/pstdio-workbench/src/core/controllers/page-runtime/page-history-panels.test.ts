import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";
import { createMemoryWorkbenchPageLocationBrowser } from "../page-location/page-location-memory";

test.each([true, false])("Back and Forward preserve workspace subpanels with open=%s", async (open) => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const workbench = createWorkbench({
    pageLocationBrowser: browser,
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, layout),
    },
    defaultPanelOpenByRegionId: { secondary: false },
    resolvePagePersistenceScope: ({ projectId, pageId, resource }) => ({
      scope: `${projectId}/${resource?.id ?? pageId}`,
    }),
  });
  const page = (id: string) => ({ extensionId: "test", kind: "page" as const, id });
  workbench.modes.registerMode({ id: "project", panels: ["main", "side", "secondary"], activate() {} });
  workbench.modes.registerMode({ id: "sessions", panels: ["main", "side"], activate() {} });
  for (const id of ["workspace", "sessions", "terminal"])
    workbench.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  for (const id of ["workspace", "sessions"])
    workbench.pages.registerPage({
      id,
      ref: page(id),
      modeId: id === "sessions" ? "sessions" : "project",
      path: id,
      main: { kind: "view", view: { kind: "view", id }, cardinality: "one" },
      slots: [],
    });
  workbench.shellPlacements.registerPlacement({
    id: "terminal",
    region: "secondary",
    hiddenByDefault: true,
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "terminal" }],
        view: { kind: "view", id: "terminal" },
        cardinality: "many",
      },
    },
  });
  workbench.pageLocations.setProject("project");
  workbench.pageLocations.navigate({ kind: "page", page: page("workspace") });
  const workspaceEntry = browser.current();
  await workbench.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "terminal" },
    resource: { type: "terminal", id: "terminal-1" },
    open: "pin",
  });
  workbench.shell.setRegionOpen("secondary", open);
  expect(browser.current()).toEqual(workspaceEntry);
  const terminal = workbench.layout.getLayout().regions.secondary.widgets[0]!;
  workbench.pageLocations.navigate({ kind: "page", page: page("sessions") });
  const sessionsEntry = browser.current();
  for (let cycle = 0; cycle < 2; cycle++) {
    workbench.pageLocations.goBack();
    expect(browser.current()).toEqual(workspaceEntry);
    expect(workbench.pages.store.getState().activePageId).toBe("workspace");
    expect(workbench.layout.getLayout().regions.secondary.widgets).toEqual([terminal]);
    expect(workbench.shell.getRegionState("secondary").open).toBe(open);
    workbench.pageLocations.goForward();
    expect(browser.current()).toEqual(sessionsEntry);
    expect(workbench.pages.store.getState().activePageId).toBe("sessions");
    expect(workbench.layout.getLayout().regions.secondary.widgets).toEqual([]);
  }
  workbench.pageLocations.goBack();
  await workbench.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "terminal" },
    resource: { type: "terminal", id: "terminal-2" },
    open: "pin",
  });
  expect(browser.current()).toEqual(workspaceEntry);
  expect(workbench.pageLocations.historyStore.getState().canGoForward).toBe(true);
  const secondary = workbench.layout.getLayout().regions.secondary;
  expect(secondary.widgets).toHaveLength(2);
  workbench.pageLocations.goForward();
  expect(browser.current()).toEqual(sessionsEntry);
  workbench.pageLocations.goBack();
  expect(workbench.layout.getLayout().regions.secondary).toEqual(secondary);
  workbench.pageLocations.dispose();
});
