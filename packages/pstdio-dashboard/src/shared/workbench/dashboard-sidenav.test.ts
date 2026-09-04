import { describe, expect, test } from "bun:test";
import { createWorkbench, type WorkbenchCore } from "@pstdio/workbench";
import { dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerDashboardSidenav } from "./dashboard-sidenav";
import { registerNavigationOwningMode } from "./mode-navigation-ownership";
import { treeViewSections } from "./workbench-view-test-helpers";

const registerModePage = (workbench: WorkbenchCore, modeId: string, pageId: string, resourceKind?: string) => {
  const viewId = `test.${pageId}.view`;
  const page = { extensionId: "test", kind: "page" as const, id: pageId };
  workbench.views.registerView({
    id: viewId,
    title: pageId,
    body: { kind: "react", render: () => null },
  });
  workbench.pages.registerPage({
    id: `test.page.${pageId}`,
    ref: page,
    title: pageId,
    path: pageId,
    modeId,
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        viewId,
        ...(resourceKind ? { binding: { resourceKinds: [resourceKind], viewId, cardinality: "one" as const } } : {}),
      },
    ],
  });
  return page;
};

describe("registerDashboardSidenav", () => {
  test("contributes the global sidenav to project and session pages", () => {
    const workbench = createWorkbench();

    registerDashboardSidenav(workbench);

    expect(workbench.modePlacements.listPlacements("project")).toEqual([
      expect.objectContaining({
        id: "dashboard.sidenav.project",
        modeId: "project",
        region: "sidenav",
        item: expect.objectContaining({ presence: "fixed" }),
      }),
    ]);
    expect(workbench.modePlacements.listPlacements("sessions")).toEqual([
      expect.objectContaining({
        id: "dashboard.sidenav.sessions",
        modeId: "sessions",
        region: "sidenav",
        item: expect.objectContaining({ presence: "fixed" }),
      }),
    ]);
  });

  test("keeps the rendered sidenav owned by the active mode", () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "sessions", label: "Sessions", activate: () => undefined });
    const projectPage = registerModePage(workbench, "project", "project");
    const sessionsPage = registerModePage(workbench, "sessions", "sessions");
    registerDashboardSidenav(workbench);

    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page: projectPage });

    expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([
      expect.objectContaining({
        viewId: dashboardWidgetIds.dashboardSidenav,
        placementIdentity: {
          kind: "mode",
          modeId: "project",
          placementId: "dashboard.sidenav.project",
          instanceKey: "default",
        },
      }),
    ]);

    workbench.pageLocations.navigate({ kind: "page", page: sessionsPage });

    expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([
      expect.objectContaining({
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
    const workbench = createWorkbench();

    workbench.modes.registerMode({ id: "lab", label: "Lab", activate: () => undefined });
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    const labPage = registerModePage(workbench, "lab", "lab");
    const projectPage = registerModePage(workbench, "project", "project");
    const ownership = registerNavigationOwningMode("lab");
    registerDashboardSidenav(workbench);

    try {
      workbench.pageLocations.setProject("project-1");
      workbench.pageLocations.navigate({ kind: "page", page: labPage });
      expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([]);

      workbench.pageLocations.navigate({ kind: "page", page: projectPage });
      expect(workbench.layout.getLayout().regions.sidenav.widgets.map((widget) => widget.viewId)).toEqual([
        dashboardWidgetIds.dashboardSidenav,
      ]);
    } finally {
      ownership.dispose();
    }
  });

  test("defaults the Sessions group to expanded", () => {
    const workbench = createWorkbench();

    registerDashboardSidenav(workbench);

    expect(workbench.treeViews.getTreeState(dashboardWidgetIds.dashboardSidenav)).toMatchObject({
      expandedNodeIds: ["workspace-sessions"],
      expandedSectionIds: ["sessions-wrap"],
    });
  });

  test("applies section defaults from contributions registered after the sidenav", () => {
    const workbench = createWorkbench();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    const page = registerModePage(workbench, "project", "late-sections");
    registerDashboardSidenav(workbench);
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page });

    workbench.navigationTrees.registerContribution({
      id: "test.late-sections",
      owner: { kind: "mode", id: "project", extensionId: "pstdio" },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      defaultExpandedSectionIds: ["files", "sessions"],
      getSections: () => [],
    });

    expect(workbench.treeViews.getTreeState(dashboardWidgetIds.dashboardSidenav).expandedSectionIds).toEqual([
      "sessions-wrap",
      "files",
      "sessions",
    ]);
  });

  test("applies page navigation defaults when the page becomes active", async () => {
    const workbench = createWorkbench();
    const pageRef = { extensionId: "test", kind: "page" as const, id: "ticket" };
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.views.registerView({
      id: "ticket",
      title: "Ticket",
      body: { kind: "react", render: () => null },
    });
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

    expect(workbench.treeViews.getTreeState(dashboardWidgetIds.dashboardSidenav).expandedSectionIds).toContain("files");
  });

  test("reads mode sections without a concrete resource and passes one when selected", async () => {
    const workbench = createWorkbench();
    const resourceReads: Array<string | undefined> = [];

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    const page = registerModePage(workbench, "project", "resources", "workspace");
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
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page });

    expect(await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav)).toMatchObject([
      { id: "resource", nodes: [{ id: "aggregate", label: "Aggregate" }] },
    ]);
    expect(resourceReads).toEqual([undefined]);

    const workspace = {
      kind: "workspace",
      uri: "pstdio://extension-resource/workspace/workspace-1",
      id: "workspace-1",
      label: "Workspace 1",
    };
    workbench.pageLocations.navigate({
      kind: "page",
      page,
      resource: { type: "workspace", id: "workspace-1", label: "Workspace 1" },
    });

    expect(await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav)).toMatchObject([
      { id: "resource", nodes: [{ id: workspace.uri, label: workspace.label }] },
    ]);
    expect(resourceReads).toEqual([undefined, workspace.uri]);

    workbench.pageLocations.navigate({ kind: "page", page });

    expect(await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav)).toMatchObject([
      { id: "resource", nodes: [{ id: "aggregate", label: "Aggregate" }] },
    ]);
    expect(resourceReads).toEqual([undefined, workspace.uri, undefined]);
  });
});

describe("dashboard sidenav mode composition", () => {
  test("uses project navigation in Sessions mode without the project Sessions link", async () => {
    const workbench = createWorkbench();

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

    const ids = (await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav))
      .flatMap((section) => section.nodes)
      .map((node) => node.id);

    expect(ids).toEqual(["search", "tickets", "workspace-sessions"]);
  });
});
