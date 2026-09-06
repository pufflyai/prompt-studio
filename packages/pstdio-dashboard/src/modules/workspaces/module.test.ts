import { describe, expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { createWorkbenchResourceActions } from "@pstdio/workbench/react";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { dashboardResourceParent } from "@/shared/workbench/resource-hierarchy";
import { dataTableViewBody, treeViewSections } from "@/shared/workbench/workbench-view-test-helpers";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "./module";

const registerTicketHierarchy = (workbench: ReturnType<typeof createWorkbench>) => {
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
  workbench.views.registerView({
    id: "test.tickets",
    title: "Tickets",
    icon: "square-kanban",
    body: { kind: "react", render: () => null },
  });
  workbench.views.registerView({
    id: "test.ticket",
    title: "Ticket",
    icon: "component",
    body: { kind: "react", render: () => null },
  });
  workbench.pages.registerPage({
    id: "test.tickets",
    ref: { extensionId: "pstdio.pstdio-planner", kind: "page", id: "tickets" },
    title: "Tickets",
    icon: "square-kanban",
    path: "tickets",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "test.tickets" }],
  });
  workbench.pages.registerPage({
    id: "test.ticket",
    ref: { extensionId: "pstdio.pstdio-planner", kind: "page", id: "ticket" },
    title: "Ticket",
    icon: "component",
    path: "ticket",
    modeId: "project",
    parentId: "test.tickets",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        binding: { resourceKinds: ["ticket"], viewId: "test.ticket", cardinality: "one" },
      },
    ],
  });
};

describe("createWorkspacesModule", () => {
  test("registers the workspace collection as a data table", () => {
    const workbench = createWorkbench();

    workbench.registerModule(createWorkspacesModule());

    expect(dataTableViewBody(workbench, dashboardWidgetIds.workspaces)).toBeDefined();

    const workspace = createDashboardResource("workspace", "workspace-1", "PS-296_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-296_A1",
      workspaceIsDefault: false,
      workspaceExecutionKind: "local",
      workspaceProviderState: "ready",
      workspaceSupportsArchive: true,
      workspaceSupportsDelete: true,
    });
    expect(createWorkbenchResourceActions(workbench, workspace).map((action) => action.label)).toEqual([
      "Open terminal",
      "Rename workspace",
      "Archive workspace",
      "Delete workspace",
    ]);
  });

  test("opens workspace resources in project mode", async () => {
    const workbench = createWorkbench();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    openWorkspacesPage(workbench, workspace);

    expect(workbench.pages.store.getState().activePageId).toBe(workbenchPages.workspace.id);
    expect(workbench.pages.getPage(workbenchPages.workspace.id)).toMatchObject({
      ref: workbenchPages.workspace,
      modeId: "project",
      path: "workspace",
      parentId: dashboardViews.workspaces.id,
    });
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.modes.getMode("workspace")).toBeUndefined();
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
    expect(workbench.layout.getActivePanel("main")?.viewId).toBe(dashboardWidgetIds.workspaceDiffs);
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.viewId)).toEqual([
      dashboardWidgetIds.workspaceDiffs,
      dashboardWidgetIds.workspaceFiles,
    ]);
    expect(
      workbench.layout
        .getLayout()
        .regions.main.widgets.filter(
          (widget) =>
            widget.viewId === dashboardWidgetIds.workspaceFiles || widget.viewId === dashboardWidgetIds.workspaceDiffs,
        )
        .map((widget) => widget.title),
    ).toEqual(["Changes", "Files"]);
    expect(workbench.views.getView(dashboardWidgetIds.workspaceDiffs)?.icon).toBe("FileDiff");
    expect(workbench.layout.getLayout().regions["main-left-menu"].widgets).toEqual([
      expect.objectContaining({
        viewId: dashboardWidgetIds.workspaceFileTree,
        ownerResourceUri: workspace.uri,
        resource: expect.objectContaining({ kind: "workspace", id: "workspace-1", label: "PS-307_A1" }),
      }),
    ]);
    expect(workbench.layout.getLayout().regions["main-right-menu"].widgets).toEqual([]);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(workspace.uri);
    expect(workbench.treeViews.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBeUndefined();

    const sidenavNodeIds = (
      await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav, { resource: workspace })
    )
      .flatMap((section) => section.nodes)
      .map((node) => node.id);
    expect(sidenavNodeIds).not.toContain(workspace.uri);
    expect(sidenavNodeIds).not.toContain("pstdio://extension-resource/dashboard-view/sessions");
  });

  test("opens same-URI workspace file metadata in Files without changing workspace ownership", async () => {
    const workbench = createWorkbench();
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

    openWorkspacesPage(workbench, workspace);
    openWorkspacesPage(workbench, fileResource);

    const layout = workbench.layout.getLayout();
    expect(workbench.layout.getActivePanel("main")?.viewId).toBe(dashboardWidgetIds.workspaceFiles);
    expect(layout.activeResourceUri).toBe(workspace.uri);
    expect(
      layout.regions.main.widgets.find((widget) => widget.viewId === dashboardWidgetIds.workspaceFiles)?.resource,
    ).toEqual({ ...fileResource, icon: undefined });
    expect(layout.regions["main-left-menu"].widgets[0]?.resource).toEqual({ ...fileResource, icon: undefined });
  });

  test("lists workspaces of the selected project as command panel resources", () => {
    const workbench = createWorkbench();

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

    expect(workspaceUris).toEqual(["pstdio://extension-resource/workspace/workspace-1"]);
  });

  test("opens the workspace creation overlay from the new workspace command", async () => {
    const workbench = createWorkbench();

    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.commands.executeCommand(dashboardCommandIds.createWorkspace);

    const overlay = workbench.layout.getActivePanel("overlay");
    expect(overlay?.viewId).toBe(dashboardWidgetIds.createWorkspace);
  });
});

describe("createWorkspacesModule navigation", () => {
  test("places workspace creation on the Workspaces navigation row", async () => {
    const workbench = createWorkbench();

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());

    const nodeIds = (
      await workbench.navigationTrees.getSections({ kind: "mode", id: "project", extensionId: "pstdio" })
    )
      .flatMap((section) => section.nodes)
      .map((node) => node.id);
    const workspacesNode = (
      await workbench.navigationTrees.getSections({ kind: "mode", id: "project", extensionId: "pstdio" })
    )
      .flatMap((section) => section.nodes)
      .find((node) => node.id === dashboardViews.workspaces.id);

    expect(nodeIds).not.toContain("new-workspace");
    expect(workspacesNode).toMatchObject({
      commandId: dashboardCommandIds.openWorkspaces,
      target: { kind: "page", page: workbenchPages.workspaces },
      actions: [
        expect.objectContaining({
          id: "new-workspace",
          commandId: dashboardCommandIds.createWorkspace,
          icon: "Plus",
        }),
      ],
    });
    expect(workspacesNode?.hiddenByDefault).toBe(true);
    expect(nodeIds).toContain(dashboardViews.workspaces.id);
  });
});

describe("createWorkspacesModule sidenav state", () => {
  test("keeps persistent Side Panel tabs when a workspace resource opens", async () => {
    const workbench = createWorkbench();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    openWorkspacesPage(workbench);
    workbench.layout.registerPanel({
      id: "test.files",
      title: "Files",
      region: "side",
      rendererId: "test.files",
    });
    workbench.layout.openPanel("test.files", { strategy: { kind: "persistent" } });

    openWorkspacesPage(workbench, workspace);

    expect(workbench.layout.listPanelInstances("side")).toEqual([
      expect.objectContaining({ panelId: "test.files", tabRetention: "persistent" }),
    ]);
  });

  test("keeps the sidenav collapsed when a workspace resource opens", async () => {
    const workbench = createWorkbench();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    openWorkspacesPage(workbench);
    workbench.panels.setOpen("sidenav", false);
    workbench.layout.setRegionVisible("sidenav", false);

    openWorkspacesPage(workbench, workspace);

    expect(workbench.panels.isOpen("sidenav")).toBe(false);
    expect(workbench.layout.getLayout().regions.sidenav.visible).toBe(false);
  });
});

describe("createWorkspacesModule breadcrumbs", () => {
  test("nests workspace breadcrumbs under the ticket when opened from a ticket", async () => {
    const workbench = createWorkbench();
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

    const ticket = (workspace.metadata as Record<string, unknown> | undefined)?.resourceParent as {
      type: string;
      id: string;
      label: string;
    };
    openWorkspacesPage(workbench, workspace, {
      kind: "page",
      page: { extensionId: "pstdio.pstdio-planner", kind: "page", id: "ticket" },
      resource: ticket,
    });

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual([
      "Tickets",
      "PS-307 Dashboard workbench datalayer",
      "PS-307_A1",
    ]);
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.icon)).toEqual([
      "square-kanban",
      "component",
      dashboardViews.workspaces.icon,
    ]);
  });

  test("uses planner ticket ancestry when opening a ticket-linked workspace", async () => {
    const workbench = createWorkbench();
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

    const childTicket = (workspace.metadata as Record<string, unknown> | undefined)?.resourceParent as {
      type: string;
      id: string;
      label: string;
      metadata: { resourceParent: { type: string; id: string; label: string } };
    };
    openWorkspacesPage(workbench, workspace, {
      kind: "page",
      page: { extensionId: "pstdio.pstdio-planner", kind: "page", id: "ticket" },
      resource: childTicket,
      parent: {
        kind: "page",
        page: { extensionId: "pstdio.pstdio-planner", kind: "page", id: "ticket" },
        resource: childTicket.metadata.resourceParent,
      },
    });

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual([
      "Tickets",
      "PS-307 Parent",
      "PS-308 Child",
      "PS-308_A1",
    ]);
  });

  test("uses the declared workspace hierarchy when no contextual target is supplied", async () => {
    const workbench = createWorkbench();

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

    openWorkspacesPage(workbench, workspace!);

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Workspaces", "PS-307_A1"]);
  });
});
