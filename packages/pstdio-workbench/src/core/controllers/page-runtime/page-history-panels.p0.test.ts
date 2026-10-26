import { describe, expect, test } from "bun:test";
import type { PlacementItem } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";
import { createMemoryWorkbenchPageLocationBrowser } from "../page-location/page-location-memory";

const createPanelWorkbench = (region: "secondary" | "side", owner: "shell" | "mode" | "page") => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const workbench = createWorkbench({
    pageLocationBrowser: browser,
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, layout),
    },
    defaultPanelOpenByRegionId: { secondary: false, side: false },
    initialSidePanelMode: "closed",
    resolvePagePersistenceScope: ({ projectId, pageId, resource }) => ({
      scope: `${projectId}/${resource?.id ?? pageId}`,
    }),
  });
  const page = (id: string) => ({ extensionId: "test", kind: "page" as const, id });
  const panelRefs = {
    shell: { kind: "shell-placement", id: "tool" },
    mode: { kind: "placement", extensionId: "test", id: "tool" },
    page: { kind: "page-slot", page: page("workspace"), id: "tool" },
  } as const;
  const item: PlacementItem = {
    kind: "binding",
    binding: {
      kinds: [{ kind: "resource-kind", id: "tool" }],
      view: { kind: "view", id: "tool" },
      cardinality: "many",
    },
  };
  const placement = { id: "tool", region, item, hiddenByDefault: true };
  workbench.modes.registerMode({ id: "project", panels: ["main", "side", "secondary"], activate() {} });
  workbench.modes.registerMode({ id: "sessions", panels: ["main"], activate() {} });
  for (const id of ["workspace", "sessions", "tool"])
    workbench.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  for (const id of ["workspace", "sessions"])
    workbench.pages.registerPage({
      id,
      ref: page(id),
      modeId: id === "sessions" ? "sessions" : "project",
      path: id,
      main: { kind: "view", view: { kind: "view", id }, cardinality: "one" },
      slots: owner === "page" && id === "workspace" ? [placement] : [],
    });
  if (owner === "shell") workbench.shellPlacements.registerPlacement(placement);
  if (owner === "mode")
    workbench.modePlacements.registerPlacement({ ...placement, modeId: "project", ref: panelRefs.mode });
  const openPanel = (id: string) => {
    const target = { kind: "panel", resource: { type: "tool", id }, open: "pin" } as const;
    if (owner === "shell") return workbench.navigation.openTarget({ ...target, panel: panelRefs.shell });
    return workbench.navigation.openTarget({ ...target, panel: panelRefs[owner] });
  };
  return { browser, workbench, page, openPanel };
};

describe.each(["secondary", "side"] as const)("%s panel history", (region) => {
  describe.each(["shell", "mode", "page"] as const)("%s-owned tabs", (owner) => {
    test.each([true, false])("Back and Forward preserve workspace subpanels with open=%s", async (open) => {
      const { browser, workbench, page, openPanel } = createPanelWorkbench(region, owner);
      workbench.pageLocations.setProject("project");
      workbench.pageLocations.navigate({ kind: "page", page: page("workspace") });
      const workspaceEntry = browser.current();
      await openPanel("z-first");
      workbench.shell.setRegionOpen(region, open);
      expect(browser.current()).toEqual(workspaceEntry);
      const firstTab = workbench.layout.getLayout().regions[region].widgets[0]!;
      workbench.pageLocations.navigate({ kind: "page", page: page("sessions") });
      const sessionsEntry = browser.current();
      for (let cycle = 0; cycle < 2; cycle++) {
        workbench.pageLocations.goBack();
        expect(browser.current()).toEqual(workspaceEntry);
        expect(workbench.pages.store.getState().activePageId).toBe("workspace");
        expect(workbench.layout.getLayout().regions[region].widgets).toEqual([firstTab]);
        expect(workbench.shell.getRegionState(region).open).toBe(open);
        workbench.pageLocations.goForward();
        expect(browser.current()).toEqual(sessionsEntry);
        expect(workbench.pages.store.getState().activePageId).toBe("sessions");
        expect(workbench.layout.getLayout().regions[region].widgets).toEqual([]);
      }
      workbench.pageLocations.goBack();
      await openPanel("a-second");
      expect(browser.current()).toEqual(workspaceEntry);
      expect(workbench.pageLocations.historyStore.getState().canGoForward).toBe(true);
      const selectedPanel = workbench.layout.getLayout().regions[region];
      expect(selectedPanel.widgets).toHaveLength(2);
      workbench.pageLocations.goForward();
      expect(browser.current()).toEqual(sessionsEntry);
      workbench.pageLocations.goBack();
      expect(workbench.layout.getLayout().regions[region]).toEqual(selectedPanel);
      workbench.layout.activatePanel(firstTab.widgetId);
      expect(browser.current()).toEqual(workspaceEntry);
      expect(workbench.pageLocations.historyStore.getState().canGoForward).toBe(true);
      workbench.pageLocations.goForward();
      workbench.pageLocations.goBack();
      expect(workbench.layout.getLayout().regions[region].activeWidgetId).toBe(firstTab.widgetId);
      workbench.pageLocations.dispose();
    });
  });
});
