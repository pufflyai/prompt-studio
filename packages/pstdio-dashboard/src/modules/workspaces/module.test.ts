import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { describeResourceRouteContract } from "pstdio-workbench/testing";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createWorkspacesModule } from "./module";

describe("createWorkspacesModule", () => {
  test("opens workspace resources in workspace mode", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(workbench.layout.getLayout().areas.left.widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.workspaceSidebar,
    ]);
    expect(workbench.layout.getLayout().areas.main.activeWidgetId).toBe(dashboardWidgetIds.workspace);
    expect(workbench.layout.getLayout().areas["main-right"].widgets).toEqual([]);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(workspace.uri);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.workspaceSidebar).selectedNodeId).toBeUndefined();

    const sidebarNodeIds = (
      await workbench.renderers.getBody(dashboardWidgetIds.workspaceSidebar, { resource: workspace })
    )
      .flatMap((section) => section.nodes)
      .map((node) => node.id);
    expect(sidebarNodeIds).not.toContain(workspace.uri);
    expect(sidebarNodeIds).not.toContain("dashboard-workbench://dashboard-view/sessions");
  });

  test("nests workspace breadcrumbs under the ticket when opened from a ticket", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
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
});

// The workspaces root (project mode) and workspace detail (workspace mode) form a cross-mode
// root/detail flow, so no single expectedMode applies — the identity and single-placement
// invariants still guard Back/Forward across the mode switch.
describeResourceRouteContract({
  name: "workspaces",
  setup: () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    return { workbench };
  },
  root: dashboardResources.workspaces,
  detail: createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
    workspaceId: "workspace-1",
    workspaceShorthand: "PS-307_A1",
  }),
  detailB: createDashboardResource("workspace", "workspace-2", "PS-308_A1", "GitBranch", "project-1", {
    workspaceId: "workspace-2",
    workspaceShorthand: "PS-308_A1",
  }),
});
