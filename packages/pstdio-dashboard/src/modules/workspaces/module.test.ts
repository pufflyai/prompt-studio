import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { syncDashboardLayoutPersistenceScope } from "@/shared/app/navigation-state";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  getSidenavContributionHeaderNodes,
  getSidenavContributionSections,
} from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { dashboardResourceParent } from "@/shared/workbench/resource-hierarchy";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "./module";

const registerTicketHierarchy = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  workbench.resources.registerKind({
    kind: "ticket",
    label: "Ticket",
    icon: "component",
  });
  const tickets = createDashboardResource("dashboard-view", "tickets", "Tickets", "square-kanban", "project-1");

  workbench.resources.registerHierarchyProvider({
    id: "test.ticket-hierarchy",
    canResolve: (resource) => resource.kind === "ticket",
    getParent: (resource) => dashboardResourceParent(workbench, resource, "project-1") ?? tickets,
  });
};

describe("createWorkspacesModule", () => {
  test("opens workspace resources in workspace mode", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(workbench.layout.getLayout().regions.sidenav.widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.dashboardSidenav,
    ]);
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe(dashboardWidgetIds.workspaceDiffs);
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.workspaceFiles,
      dashboardWidgetIds.workspace,
      dashboardWidgetIds.workspaceDiffs,
    ]);
    expect(
      workbench.layout
        .getLayout()
        .regions.main.widgets.filter(
          (widget) =>
            widget.contributionId === dashboardWidgetIds.workspaceFiles ||
            widget.contributionId === dashboardWidgetIds.workspaceDiffs,
        )
        .map((widget) => widget.title),
    ).toEqual(["Files", "Changes"]);
    expect(workbench.layout.getPanel(dashboardWidgetIds.workspaceDiffs)?.icon).toBe("FileDiff");
    expect(workbench.layout.getLayout().regions["main-left-menu"].widgets).toEqual([
      expect.objectContaining({
        contributionId: dashboardWidgetIds.workspaceFileTree,
        ownerResourceUri: workspace.uri,
        resource: workspace,
      }),
    ]);
    expect(workbench.layout.getLayout().regions["main-right-menu"].widgets).toEqual([]);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(workspace.uri);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBeUndefined();

    const sidenavNodeIds = (
      await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav, { resource: workspace })
    )
      .flatMap((section) => section.nodes)
      .map((node) => node.id);
    expect(sidenavNodeIds).not.toContain(workspace.uri);
    expect(sidenavNodeIds).not.toContain("dashboard-workbench://dashboard-view/sessions");
  });

  test("opens same-URI workspace file metadata in Files without changing workspace ownership", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });
    const fileResource = {
      ...workspace,
      metadata: { ...workspace.metadata, workspaceView: "files", workspaceFilePath: "src/index.ts" },
    };

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });
    await workbench.resources.openResource(fileResource, { replaceActive: true });

    const layout = workbench.layout.getLayout();
    expect(layout.regions.main.activeWidgetId).toBe(dashboardWidgetIds.workspaceFiles);
    expect(layout.activeResourceUri).toBe(workspace.uri);
    expect(
      layout.regions.main.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.workspaceFiles)
        ?.resource,
    ).toEqual(fileResource);
    expect(layout.regions["main-left-menu"].widgets[0]?.resource).toEqual(fileResource);
  });

  test("lists workspaces of the selected project as command panel resources", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-1",
        project_id: "project-1",
        name: "Dashboard workbench datalayer",
        branch: "workspace/PS-307_A1",
        worktree_path: "/repo/.pstdio/workspaces/PS-307_A1",
        archived: false,
        workspace_shorthand: "PS-307_A1",
        setup_error: null,
        created_at: "2026-05-22T08:10:00Z",
        updated_at: "2026-05-22T08:50:00Z",
        deleted_at: null,
      },
      {
        id: "workspace-2",
        project_id: "project-2",
        name: "Other project workspace",
        branch: "main",
        worktree_path: null,
        archived: false,
        workspace_shorthand: "PS-999_A1",
        setup_error: null,
        created_at: "2026-05-21T08:10:00Z",
        updated_at: "2026-05-21T08:50:00Z",
        deleted_at: null,
      },
    ]);

    const entries = workbench.resources.listResources("");
    const workspaceUris = entries
      .filter((entry) => entry.resource.kind === "workspace")
      .map((entry) => entry.resource.uri);

    expect(workspaceUris).toEqual(["dashboard-workbench://workspace/workspace-1"]);
  });

  test("opens the workspace creation overlay from the new workspace command", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.commands.executeCommand(dashboardCommandIds.createWorkspace);

    expect(workbench.layout.getLayout().regions.overlay.activeWidgetId).toBe(dashboardWidgetIds.createWorkspace);
  });
});

describe("createWorkspacesModule navigation", () => {
  test("places workspace creation on the Workspaces navigation row", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());

    const headerNodeIds = getSidenavContributionHeaderNodes(workbench, "project").map((node) => node.id);
    const workspacesNode = getSidenavContributionHeaderNodes(workbench, "project").find(
      (node) => node.id === dashboardResources.workspaces.uri,
    );

    expect(headerNodeIds).not.toContain("new-workspace");
    expect(workspacesNode).toMatchObject({
      commandId: dashboardCommandIds.openWorkspaces,
      actions: [
        expect.objectContaining({
          id: "new-workspace",
          commandId: dashboardCommandIds.createWorkspace,
          icon: "Plus",
        }),
      ],
    });
    expect(
      (await getSidenavContributionSections(workbench, "project"))
        .flatMap((section) => section.nodes)
        .map((node) => node.id),
    ).not.toContain(dashboardResources.workspaces.uri);
  });
});

describe("createWorkspacesModule sidenav state", () => {
  test("keeps persistent Side Panel tabs when workspace navigation changes the active mode", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    syncDashboardLayoutPersistenceScope(workbench);
    workbench.layout.registerPanel({
      id: "test.files",
      title: "Files",
      region: "side",
      rendererId: "test.files",
    });
    workbench.layout.openPanel("test.files", { strategy: { kind: "persistent" } });

    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(workbench.layout.listPanelInstances("side")).toEqual([
      expect.objectContaining({ panelId: "test.files", tabRetention: "persistent" }),
    ]);
  });

  test("keeps the sidenav collapsed when workspace navigation changes the active mode", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    syncDashboardLayoutPersistenceScope(workbench);
    workbench.panels.setOpen("sidenav", false);
    workbench.layout.setRegionVisible("sidenav", false);

    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(workbench.panels.isOpen("sidenav")).toBe(false);
    expect(workbench.layout.getLayout().regions.sidenav.visible).toBe(false);
  });
});

describe("createWorkspacesModule breadcrumbs", () => {
  test("nests workspace breadcrumbs under the ticket when opened from a ticket", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-direct", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-direct",
      workspaceShorthand: "PS-307_A1",
      resourceParent: {
        type: "ticket",
        id: "ticket-1",
        label: "PS-307 Dashboard workbench datalayer",
        metadata: { shorthand: "PS-307" },
      },
    });

    workbench.registerModule(createWorkspacesModule());
    registerTicketHierarchy(workbench);
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual([
      "Tickets",
      "PS-307 Dashboard workbench datalayer",
      "PS-307_A1",
    ]);
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.icon)).toEqual([
      "square-kanban",
      "component",
      "GitBranch",
    ]);
  });

  test("uses planner ticket ancestry when opening a ticket-linked workspace", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-child", "PS-308_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-child",
      workspaceShorthand: "PS-308_A1",
      resourceParent: {
        type: "ticket",
        id: "ticket-child",
        label: "PS-308 Child",
        metadata: {
          shorthand: "PS-308",
          resourceParent: {
            type: "ticket",
            id: "ticket-parent",
            label: "PS-307 Parent",
            metadata: { shorthand: "PS-307" },
          },
        },
      },
    });

    workbench.registerModule(createWorkspacesModule());
    registerTicketHierarchy(workbench);
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual([
      "Tickets",
      "PS-307 Parent",
      "PS-308 Child",
      "PS-308_A1",
    ]);
  });

  test("nests synced ticket-linked workspace breadcrumbs under the ticket", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createWorkspacesModule());
    registerTicketHierarchy(workbench);
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-1",
        project_id: "project-1",
        name: null,
        branch: "workspace/PS-307_A1",
        worktree_path: "/repo/.pstdio/workspaces/PS-307_A1",
        archived: false,
        workspace_shorthand: "PS-307_A1",
        setup_error: null,
        anchors_json: [
          {
            type: "ticket",
            id: "ticket-1",
            projectId: "project-1",
            extensionId: "pstdio-planner",
            label: "PS-307",
            metadata: { shorthand: "PS-307" },
          },
        ],
        created_at: "2026-05-22T08:10:00Z",
        updated_at: "2026-05-22T08:50:00Z",
        deleted_at: null,
      },
    ]);

    const workspace = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.kind === "workspace")?.resource;

    await workbench.resources.openResource(workspace!, { replaceActive: true });

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Tickets", "PS-307", "PS-307_A1"]);
  });
});
