import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardNavigationResource, selectDashboardNavigationView } from "@/shared/app/navigation-state";
import { dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerDashboardSidenav } from "./dashboard-sidenav";
import { registerNavigationOwningMode } from "./mode-navigation-ownership";

describe("registerDashboardSidenav", () => {
  test("contributes the global sidenav to project and session pages", () => {
    const workbench = createWorkbenchCore();

    registerDashboardSidenav(workbench);

    expect(workbench.modePlacements.listPlacements("project")).toEqual([
      expect.objectContaining({
        id: "dashboard.sidenav.project",
        modeId: "project",
        region: "sidenav",
        required: true,
      }),
    ]);
    expect(workbench.modePlacements.listPlacements("sessions")).toEqual([
      expect.objectContaining({
        id: "dashboard.sidenav.sessions",
        modeId: "sessions",
        region: "sidenav",
        required: true,
      }),
    ]);
  });

  test("keeps the rendered sidenav owned by the active mode", () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "sessions", label: "Sessions", activate: () => undefined });
    registerDashboardSidenav(workbench);

    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.leavePage("project");

    const projectWidget = workbench.layout.getLayout().regions.sidenav.widgets[0];
    expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([
      expect.objectContaining({
        contributionId: dashboardWidgetIds.dashboardSidenav,
        placementIdentity: {
          kind: "mode",
          modeId: "project",
          placementId: "dashboard.sidenav.project",
          instanceKey: "default",
        },
      }),
    ]);

    workbench.pageLocations.leavePage("sessions");

    expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([
      expect.objectContaining({
        widgetId: projectWidget?.widgetId,
        placementIdentity: {
          kind: "mode",
          modeId: "sessions",
          placementId: "dashboard.sidenav.sessions",
          instanceKey: "default",
        },
      }),
    ]);
  });

  test("keeps the sidenav hidden while a navigation-owning mode is active", () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "lab", label: "Lab", activate: () => undefined });
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    const ownership = registerNavigationOwningMode("lab");
    registerDashboardSidenav(workbench);

    try {
      workbench.pageLocations.setProject("project-1");
      workbench.pageLocations.leavePage("lab");
      expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([]);

      workbench.pageLocations.leavePage("project");
      expect(workbench.layout.getLayout().regions.sidenav.widgets.map((widget) => widget.contributionId)).toEqual([
        dashboardWidgetIds.dashboardSidenav,
      ]);
    } finally {
      ownership.dispose();
    }
  });

  test("defaults the Sessions group to expanded", () => {
    const workbench = createWorkbenchCore();

    registerDashboardSidenav(workbench);

    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav)).toMatchObject({
      expandedNodeIds: ["workspace-sessions"],
      expandedSectionIds: ["sessions-wrap"],
    });
  });

  test("applies section defaults from contributions registered after the sidenav", () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    registerDashboardSidenav(workbench);
    workbench.modes.setActiveMode("project");

    workbench.navigationTrees.registerContribution({
      id: "test.late-sections",
      owner: { kind: "mode", id: "project", extensionId: "pstdio" },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      defaultExpandedSectionIds: ["files", "sessions"],
      getSections: () => [],
    });

    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).expandedSectionIds).toEqual([
      "sessions-wrap",
      "files",
      "sessions",
    ]);
  });

  test("applies page navigation defaults when the page becomes active", async () => {
    const workbench = createWorkbenchCore();
    const pageRef = { extensionId: "test", kind: "page" as const, id: "ticket" };
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.layout.registerPanel({ id: "ticket", title: "Ticket", region: "main", rendererId: "ticket" });
    workbench.views.registerView({ id: "ticket", panelId: "ticket", title: "Ticket" });
    workbench.pages.registerPage({
      id: "test.page.ticket",
      ref: pageRef,
      title: "Ticket",
      path: "ticket",
      modeId: "project",
      slots: [{ id: "content", role: "primary", region: "main", viewId: "ticket" }],
    });
    workbench.navigationTrees.registerContribution({
      id: "test.ticket-files",
      owner: { kind: "page", id: "test.page.ticket", extensionId: "test" },
      sourceExtensionId: "test",
      declarationIndex: 0,
      defaultExpandedSectionIds: ["files"],
      getSections: () => [{ id: "files", label: "Files", nodes: [] }],
    });
    registerDashboardSidenav(workbench);
    workbench.pageLocations.setProject("project-1");

    await workbench.navigation.openTarget({ kind: "page", page: pageRef });

    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).expandedSectionIds).toContain("files");
  });

  test("reads mode sections without a concrete resource and passes one when selected", async () => {
    const workbench = createWorkbenchCore();
    const resourceReads: Array<string | undefined> = [];

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.navigationTrees.registerContribution({
      id: "test.resource-sections",
      owner: { kind: "mode", id: "project", extensionId: "pstdio" },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: (input) => {
        resourceReads.push(input.resource?.uri);
        return [
          {
            id: "resource",
            nodes: [
              {
                id: input.resource?.uri ?? "aggregate",
                label: input.resource?.label ?? "Aggregate",
              },
            ],
          },
        ];
      },
    });
    registerDashboardSidenav(workbench);
    workbench.modes.setActiveMode("project");

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav)).toMatchObject([
      { id: "resource", nodes: [{ id: "aggregate", label: "Aggregate" }] },
    ]);
    expect(resourceReads).toEqual([undefined]);

    const workspace = {
      kind: "workspace",
      uri: "dashboard-workbench://workspace/workspace-1",
      id: "workspace-1",
      label: "Workspace 1",
    };
    selectDashboardNavigationResource(workbench, workspace);

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav)).toMatchObject([
      { id: "resource", nodes: [{ id: workspace.uri, label: workspace.label }] },
    ]);
    expect(resourceReads).toEqual([undefined, workspace.uri]);

    selectDashboardNavigationView(workbench, dashboardViews.workspaces.id);

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav)).toMatchObject([
      { id: "resource", nodes: [{ id: "aggregate", label: "Aggregate" }] },
    ]);
    expect(resourceReads).toEqual([undefined, workspace.uri, undefined]);
  });

  test("uses project navigation in Sessions mode without the project Sessions link", async () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "sessions", label: "Sessions", activate: () => undefined });
    workbench.navigationTrees.registerContribution({
      id: "test.project-navigation",
      owner: { kind: "mode", id: "project", extensionId: "pstdio" },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: () => [
        {
          id: "navigation.root",
          nodes: [
            { id: "search", label: "Search" },
            { id: dashboardViews.sessions.id, label: dashboardViews.sessions.label },
            { id: "tickets", label: "Tickets" },
          ],
        },
      ],
    });
    workbench.navigationTrees.registerContribution({
      id: "test.session-list",
      owner: { kind: "mode", id: "sessions", extensionId: "pstdio" },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: () => [
        {
          id: "sessions-wrap",
          nodes: [{ id: "workspace-sessions", label: "Sessions" }],
        },
      ],
    });
    registerDashboardSidenav(workbench);
    workbench.modes.setActiveMode("sessions");

    const ids = (await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav))
      .flatMap((section) => section.nodes)
      .map((node) => node.id);

    expect(ids).toEqual(["search", "tickets", "workspace-sessions"]);
  });
});
