import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  getSidebarContributionHeaderNodes,
  getSidebarContributionSections,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { createSessionBubbleModule } from "../sessions/bubble/module";
import { createSidebarModule } from "../sidebar/module";
import { createWorkspacesModule } from "./module";

describe("createWorkspacesModule", () => {
  test("opens workspace resources in workspace mode", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSidebarModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(workbench.layout.getLayout().areas.left.widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.dashboardSidebar,
    ]);
    expect(workbench.layout.getLayout().areas.main.activeWidgetId).toBe(dashboardWidgetIds.workspace);
    expect(workbench.layout.getLayout().areas["main-right"].widgets).toEqual([]);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(workspace.uri);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidebar).selectedNodeId).toBeUndefined();

    const sidebarNodeIds = (
      await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidebar, { resource: workspace })
    )
      .flatMap((section) => section.nodes)
      .map((node) => node.id);
    expect(sidebarNodeIds).not.toContain(workspace.uri);
    expect(sidebarNodeIds).not.toContain("dashboard-workbench://dashboard-view/sessions");
  });

  test("opens the last active linked session in the floating panel when a workspace opens", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSidebarModule());
    workbench.registerModule(createSessionBubbleModule());
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
    ]);
    getWriter("sessions")?.truncateAndWrite([
      {
        id: "session-older",
        project_id: "project-1",
        title: "Recently active session",
        status: "completed",
        agent: null,
        last_selected_model: null,
        archived: false,
        last_request_started: "2026-05-22T09:40:00Z",
        last_request_ended: "2026-05-22T09:45:00Z",
        created_at: "2026-05-22T08:20:00Z",
        updated_at: "2026-05-22T08:20:00Z",
        deleted_at: null,
      },
      {
        id: "session-newer",
        project_id: "project-1",
        title: "Newer row",
        status: "completed",
        agent: null,
        last_selected_model: null,
        archived: false,
        last_request_started: "2026-05-22T08:30:00Z",
        last_request_ended: "2026-05-22T08:35:00Z",
        created_at: "2026-05-22T08:30:00Z",
        updated_at: "2026-05-22T08:30:00Z",
        deleted_at: null,
      },
    ]);
    getWriter("workspace_sessions")?.truncateAndWrite([
      { id: "link-older", workspace_id: "workspace-1", session_id: "session-older" },
      { id: "link-newer", workspace_id: "workspace-1", session_id: "session-newer" },
    ]);

    const workspace = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.kind === "workspace")?.resource;

    await workbench.resources.openResource(workspace!, { replaceActive: true });

    const floatingSession = workbench.layout
      .getLayout()
      .areas.floating.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble);

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(workbench.layout.getLayout().activeResourceUri).toBe("dashboard-workbench://workspace/workspace-1");
    expect(floatingSession?.resource?.uri).toBe("dashboard-workbench://session/session-older");
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidebar).selectedNodeId).toBe(
      "dashboard-workbench://session/session-older",
    );
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

    expect(workbench.layout.getLayout().areas.overlay.activeWidgetId).toBe(dashboardWidgetIds.createWorkspace);
  });

  test("places workspace creation on the Workspaces navigation row", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSidebarModule());
    workbench.registerModule(createWorkspacesModule());

    const headerNodeIds = getSidebarContributionHeaderNodes(workbench, "project").map((node) => node.id);
    const workspacesNode = getSidebarContributionSections(workbench, "project")
      .flatMap((section) => section.nodes)
      .find((node) => node.id === dashboardResources.workspaces.uri);

    expect(headerNodeIds).not.toContain("new-workspace");
    expect(workspacesNode?.actions).toEqual([
      expect.objectContaining({
        id: "new-workspace",
        commandId: dashboardCommandIds.createWorkspace,
        icon: "Plus",
      }),
    ]);
  });

  test("keeps ticket-linked workspaces fixed in the ticket sidebar", () => {
    const workbench = createWorkbenchCore();
    const ticket = createDashboardResource("ticket", "ticket-1", "PS-307", "FileText", "project-1");

    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.layout.registerWidget({
      id: "test.ticket",
      title: "Ticket",
      area: "main",
      rendererId: "test.ticket",
    });
    workbench.layout.openWidget("test.ticket", { resource: ticket });
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
            label: "PS-307",
            metadata: { shorthand: "PS-307" },
          },
        ],
        created_at: "2026-05-22T08:10:00Z",
        updated_at: "2026-05-22T08:50:00Z",
        deleted_at: null,
      },
    ]);

    expect(getSidebarContributionSections(workbench, "ticket")).toEqual([
      expect.objectContaining({
        id: "ticket-linked-workspaces",
        label: "Workspaces",
      }),
    ]);
    expect(getSidebarContributionSections(workbench, "ticket")[0]).not.toHaveProperty("canHide");
  });
});

describe("createWorkspacesModule breadcrumbs", () => {
  test("nests workspace breadcrumbs under the ticket when opened from a ticket", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-direct", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-direct",
      workspaceShorthand: "PS-307_A1",
      ticketId: "ticket-1",
      ticketLabel: "PS-307 Dashboard workbench datalayer",
      ticketShorthand: "PS-307",
    });

    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual([
      "Tickets",
      "PS-307 Dashboard workbench datalayer",
      "PS-307_A1",
    ]);
  });

  test("uses planner ticket ancestry when opening a ticket-linked workspace", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-child", "PS-308_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-child",
      workspaceShorthand: "PS-308_A1",
      ticketId: "ticket-child",
      ticketLabel: "PS-308 Child",
      ticketShorthand: "PS-308",
      ticketBreadcrumb: [
        { id: "ticket-parent", label: "PS-307 Parent", shorthand: "PS-307" },
        { id: "ticket-child", label: "PS-308 Child", shorthand: "PS-308" },
      ],
    });

    workbench.registerModule(createWorkspacesModule());
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
