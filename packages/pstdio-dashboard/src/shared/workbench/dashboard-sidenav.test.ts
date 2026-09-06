import { describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchCore } from "@pstdio/workbench";
import { dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerDashboardSidenav } from "./dashboard-sidenav";
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
    ...(resourceKind
      ? {
          resource: { kinds: [{ kind: "resource-kind" as const, id: resourceKind }] },
        }
      : {}),
    main: { kind: "panels", empty: { kind: "view", id: viewId } },
    slots: [],
  });
  return page;
};
describe("registerDashboardSidenav", () => {
  test("supplies the same host navigation in every mode that retains host chrome", () => {
    const workbench = createWorkbench();
    const modes = ["project", "sessions", "acme.notes.mode.review"];
    const pages = modes.map((modeId) => {
      workbench.modes.registerMode({ id: modeId, activate: () => undefined });
      return registerModePage(workbench, modeId, modeId);
    });
    registerDashboardSidenav(workbench);
    workbench.pageLocations.setProject("project-1");
    for (const page of pages) {
      workbench.pageLocations.navigate({ kind: "page", page });
      expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([
        expect.objectContaining({
          viewId: dashboardWidgetIds.dashboardSidenav,
          placementIdentity: {
            kind: "shell",
            placementId: "dashboard.sidenav",
            instanceKey: "default",
          },
        }),
      ]);
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
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "ticket",
        },
        cardinality: "one",
      },
      slots: [],
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
    const home = registerModePage(workbench, "project", "resources");
    const page = registerModePage(workbench, "project", "workspace", "workspace");
    workbench.navigationTrees.registerContribution({
      id: "test.resource-sections",
      owner: { kind: "mode", id: "project", extensionId: "pstdio" },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: (input) => {
        resourceReads.push(resourceKey(input.resource));
        return [
          {
            id: "resource",
            nodes: [
              {
                id: resourceKey(input.resource) ?? "aggregate",
                label: input.resource?.label ?? "Aggregate",
              },
            ],
          },
        ];
      },
    });
    registerDashboardSidenav(workbench);
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page: home });
    expect(await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav)).toMatchObject([
      { id: "resource", nodes: [{ id: "aggregate", label: "Aggregate" }] },
    ]);
    expect(resourceReads).toEqual([undefined]);
    const workspace = {
      type: "workspace",
      id: "workspace-1",
      label: "Workspace 1",
    };
    workbench.pageLocations.navigate({
      kind: "page",
      page,
      resource: { type: "workspace", id: "workspace-1", label: "Workspace 1" },
    });
    expect(await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav)).toMatchObject([
      { id: "resource", nodes: [{ id: resourceKey(workspace), label: workspace.label }] },
    ]);
    expect(resourceReads).toEqual([undefined, resourceKey(workspace)]);
    workbench.pageLocations.navigate({ kind: "page", page: home });
    expect(await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav)).toMatchObject([
      { id: "resource", nodes: [{ id: "aggregate", label: "Aggregate" }] },
    ]);
    expect(resourceReads).toEqual([undefined, resourceKey(workspace), undefined]);
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
