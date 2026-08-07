import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  clearCachedDashboardExtensionMetadata,
  type DashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import {
  getSidenavContributionHeaderNodes,
  getSidenavContributionSections,
} from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { createProjectsModule } from "../projects/module";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "../workspaces/module";
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
});

describe("createExtensionsModule mode layout persistence", () => {
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
});

describe("extension tree mode visibility", () => {
  test("keeps unrestricted extension tree items available in custom modes", async () => {
    const loadMetadata = mock(async () => metadataWithLabMode);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      const projectNodeIds = (await getSidenavContributionSections(workbench, "project"))
        .flatMap((section) => section.nodes)
        .map((node) => node.id);
      const labNodeIds = (await getSidenavContributionSections(workbench, "pstdio.extension-lab.lab"))
        .flatMap((section) => section.nodes)
        .map((node) => node.id);

      expect(projectNodeIds).toContain("dashboard-workbench://project/project-1/extensions/lab");
      expect(labNodeIds).toContain("dashboard-workbench://project/project-1/extensions/lab");
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("filters extension tree items by their mode condition", async () => {
    const labModeMetadata = {
      ...metadataWithLabMode,
      commands: [
        ...metadataWithLabMode.commands,
        { id: "extension-lab.project-command", extensionId: "pstdio.extension-lab", title: "Project command" },
        { id: "extension-lab.lab-command", extensionId: "pstdio.extension-lab", title: "Lab command" },
      ],
      treeItems: [
        ...metadataWithLabMode.treeItems,
        {
          id: "extension-lab.projectOnly",
          extensionId: "pstdio.extension-lab",
          target: "workbench.left.tree",
          group: "Lab",
          label: "Project only",
          action: { kind: "command", commandId: "extension-lab.project-command" },
          when: { mode: "project" },
        },
        {
          id: "extension-lab.labOnly",
          extensionId: "pstdio.extension-lab",
          target: "workbench.left.tree",
          group: "Lab",
          label: "Lab only",
          action: { kind: "command", commandId: "extension-lab.lab-command" },
          when: { mode: "pstdio.extension-lab.lab" },
        },
      ],
    } satisfies DashboardExtensionMetadata;
    const loadMetadata = mock(async () => labModeMetadata);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      const projectNodeIds = (await getSidenavContributionSections(workbench, "project"))
        .flatMap((section) => section.nodes)
        .map((node) => node.id);
      const labNodeIds = (await getSidenavContributionSections(workbench, "pstdio.extension-lab.lab"))
        .flatMap((section) => section.nodes)
        .map((node) => node.id);

      expect(projectNodeIds).toContain("dashboard-workbench://project/project-1/extensions/lab");
      expect(projectNodeIds).toContain("extension-lab.projectOnly");
      expect(projectNodeIds).not.toContain("extension-lab.labOnly");
      expect(labNodeIds).toContain("dashboard-workbench://project/project-1/extensions/lab");
      expect(labNodeIds).not.toContain("extension-lab.projectOnly");
      expect(labNodeIds).toContain("extension-lab.labOnly");
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("keeps host navigation available in custom mode sidenav chrome", async () => {
    const loadMetadata = mock(async () => metadataWithLabMode);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const sidenavDisposable = workbench.registerModule(createSidenavModule());
    const workspacesDisposable = workbench.registerModule(createWorkspacesModule());
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();
      workbench.modes.setActiveMode("pstdio.extension-lab.lab");

      expect(
        getSidenavContributionHeaderNodes(workbench, "pstdio.extension-lab.lab").map((node) => node.label),
      ).toContain("Workspaces");
    } finally {
      disposable.dispose();
      workspacesDisposable.dispose();
      sidenavDisposable.dispose();
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
