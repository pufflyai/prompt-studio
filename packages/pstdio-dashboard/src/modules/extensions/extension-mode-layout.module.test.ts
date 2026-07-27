import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { getSidenavContributionSections } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { createProjectsModule } from "../projects/module";
import { createSidenavModule } from "../sidenav/module";
import { createExtensionsModule } from "./module";
import {
  emptyAppearance,
  flushMicrotasks,
  metadata,
  metadataWithLabMode,
  metadataWithTickets,
} from "./module-test-fixtures";

describe("createExtensionsModule mode layout", () => {
  test("attaches Panel Menus to the Location established by mode navigation", async () => {
    const overviewId = "extension-lab.labOverview";
    const menuId = "extension-lab.labTools";
    const loadMetadata = mock(async () => ({
      ...metadataWithLabMode,
      panels: metadataWithLabMode.panels.map((panel) =>
        panel.id === overviewId
          ? {
              ...panel,
              panelMenus: [
                {
                  id: menuId,
                  extensionId: panel.extensionId,
                  ownerPanelId: overviewId,
                  title: "Coding tools",
                  side: "left" as const,
                  webview: panel.webview,
                },
              ],
            }
          : panel,
      ),
    }));
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();
      workbench.modes.setActiveMode("pstdio.extension-lab.lab");

      expect(workbench.layout.getLayout().activeLocationWidgetId).toBe(
        "dashboard-workbench.extension-view.extension-lab.labOverview",
      );
      expect(
        workbench.layout.getLayout().regions["main-left-menu"].widgets.map((panel) => panel.contributionId),
      ).toEqual(["dashboard-workbench.extension-view.extension-lab.labTools"]);
      expect(workbench.layout.getLayout().regions["main-left-menu"].widgets[0]?.ownerResourceUri).toBe(
        workbench.getPrimaryResource()?.uri,
      );
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("registers extension-lab modes and mounts their extension views", async () => {
    const loadMetadata = mock(async () => metadataWithLabMode);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const sidenavDisposable = workbench.registerModule(createSidenavModule());
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));
    const projectsDisposable = workbench.registerModule(createProjectsModule());

    try {
      await flushMicrotasks();

      expect(workbench.modes.getMode("pstdio.extension-lab.lab")).toMatchObject({ label: "Lab" });

      workbench.modes.setActiveMode("pstdio.extension-lab.lab");

      expect(workbench.layout.getLayout().regions.sidenav.widgets.map((widget) => widget.contributionId)).toEqual([
        dashboardWidgetIds.dashboardSidenav,
        "dashboard-workbench.extension-view.extension-lab.labSidenav",
      ]);
      expect(workbench.layout.getLayout().regions.sidenav.activeWidgetId).toBe(
        "dashboard-workbench.extension-view.extension-lab.labSidenav",
      );
      expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
        "dashboard-workbench.extension-view.extension-lab.labOverview",
      ]);
      expect(workbench.layout.getLayout().activeLocationWidgetId).toBe(
        "dashboard-workbench.extension-view.extension-lab.labOverview",
      );
      expect(
        workbench.layout.getPanel("dashboard-workbench.extension-view.extension-lab.labOverview")?.eligibleLocations,
      ).toBeUndefined();
      expect(
        workbench.layout.getPanel("dashboard-workbench.extension-view.extension-lab.labSidenav")?.eligibleLocations,
      ).toEqual({ modeIds: ["pstdio.extension-lab.lab"] });
    } finally {
      projectsDisposable.dispose();
      disposable.dispose();
      sidenavDisposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("keeps the active extension mode layout mounted across webview metadata refreshes", async () => {
    let nextMetadata = metadataWithLabMode;
    const loadMetadata = mock(async () => nextMetadata);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const sidenavDisposable = workbench.registerModule(createSidenavModule());
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();
      workbench.modes.setActiveMode("pstdio.extension-lab.lab");

      nextMetadata = {
        ...metadataWithLabMode,
        panels: metadataWithLabMode.panels.map((panel) => ({
          ...panel,
          webview: { ...panel.webview, moduleUrl: `${panel.webview.moduleUrl}?h=2` },
        })),
      };
      getWriter("installed_extension_sources")?.upsert({ id: "extension-lab" });
      await flushMicrotasks();

      expect(workbench.modes.getActiveModeId()).toBe("pstdio.extension-lab.lab");
      expect(workbench.layout.getLayout().regions.sidenav.widgets.map((widget) => widget.contributionId)).toEqual([
        dashboardWidgetIds.dashboardSidenav,
        "dashboard-workbench.extension-view.extension-lab.labSidenav",
      ]);
      expect(workbench.layout.getLayout().regions.sidenav.activeWidgetId).toBe(
        "dashboard-workbench.extension-view.extension-lab.labSidenav",
      );
      expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
        "dashboard-workbench.extension-view.extension-lab.labOverview",
      ]);
    } finally {
      disposable.dispose();
      sidenavDisposable.dispose();
      getWriter("installed_extension_sources")?.truncateAndWrite([]);
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("reopens a mode-layout extension view in the primary region on history replay", async () => {
    const loadMetadata = mock(async () => metadataWithLabMode);
    const loadAppearance = mock(async () => emptyAppearance);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, loadAppearance }));

    try {
      await flushMicrotasks();
      workbench.modes.setActiveMode("pstdio.extension-lab.lab");

      const mainResource = workbench.layout.getLayout().regions.main.widgets[0]?.resource;
      expect(mainResource?.kind).toBe("extension-view");

      // Navigate the primary region away, then replay the extension-view entry the way history
      // goBack/goForward does (openResource with replaceActive). Before the view presenter existed,
      // this rejected with "No presenter registered for resource kind: extension-view".
      workbench.layout.openPanel(dashboardWidgetIds.extensionRoute, { strategy: { kind: "replace-active" } });
      await workbench.resources.openResource(mainResource!, { replaceActive: true });

      expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
        "dashboard-workbench.extension-view.extension-lab.labOverview",
      ]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("does not statically open resource-bound mode layout views", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      workbench.modes.setActiveMode("pstdio-core-tickets.ticket");

      expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([]);
      expect(workbench.layout.getLayout().regions["main-left-menu"].widgets).toEqual([]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("contributes extension tree items only to the project sidenav", async () => {
    const loadMetadata = mock(async () => metadata);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      const projectNodeIds = (await getSidenavContributionSections(workbench, "project"))
        .flatMap((section) => section.nodes)
        .map((node) => node.id);
      const workspaceNodeIds = (await getSidenavContributionSections(workbench, "workspace"))
        .flatMap((section) => section.nodes)
        .map((node) => node.id);

      expect(projectNodeIds).toContain("dashboard-workbench://project/project-1/extensions/lab");
      expect(workspaceNodeIds).not.toContain("dashboard-workbench://project/project-1/extensions/lab");
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("shows extension tree items before breadcrumb navigation selects a resource", async () => {
    const loadMetadata = mock(async () => metadata);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.setActiveMode("project");
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.registerModule(createSidenavModule());
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      const nodeIds = (await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav))
        .flatMap((section) => section.nodes)
        .map((node) => node.id);

      expect(nodeIds).toContain("dashboard-workbench://project/project-1/extensions/lab");
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
