import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionBubbleModule } from "./bubble/module";
import { createSessionsModule } from "./module";

const createWorkspaceSessionWorkbench = () => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createSidenavModule());
  workbench.registerModule(createSessionBubbleModule());
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionsModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  return workbench;
};

describe("createSessionsModule workspace session scoping", () => {
  test("scopes the project-mode session list to the open workspace resource", async () => {
    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-1",
        project_id: "project-1",
        name: "Workspace one",
        branch: "workspace/PS-1",
        worktree_path: "/repo/.pstdio/workspaces/PS-1",
        archived: false,
        workspace_shorthand: "PS-1",
        setup_error: null,
        created_at: "2026-06-01T08:00:00Z",
        updated_at: "2026-06-01T08:00:00Z",
        deleted_at: null,
      },
    ]);
    getWriter("sessions")?.truncateAndWrite([
      {
        id: "session-linked",
        project_id: "project-1",
        title: "Linked session",
        status: "completed",
        agent: null,
        last_selected_model: null,
        archived: false,
        created_at: "2026-06-02T10:00:00Z",
        updated_at: "2026-06-02T10:00:00Z",
        deleted_at: null,
      },
      {
        id: "session-unlinked",
        project_id: "project-1",
        title: "Unlinked session",
        status: "completed",
        agent: null,
        last_selected_model: null,
        archived: false,
        created_at: "2026-06-02T11:00:00Z",
        updated_at: "2026-06-02T11:00:00Z",
        deleted_at: null,
      },
    ]);
    getWriter("workspace_sessions")?.truncateAndWrite([
      { id: "link-1", workspace_id: "workspace-1", session_id: "session-linked" },
    ]);

    const workbench = createWorkspaceSessionWorkbench();
    const workspace = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.kind === "workspace")?.resource;
    await workbench.resources.openResource(workspace!, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("project");

    const sessionsGroup = (await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav, {}))
      .flatMap((section) => section.nodes)
      .find((node) => node.id === "workspace-sessions");
    const sessionRowIds = (sessionsGroup?.children ?? [])
      .filter((node) => node.resource || node.target)
      .map((node) => node.id);

    expect(sessionRowIds).toEqual(["dashboard-workbench://session/session-linked"]);
  });

  test("rescopes the session list when switching between workspaces", async () => {
    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-1",
        project_id: "project-1",
        name: "Workspace one",
        branch: "workspace/PS-1",
        worktree_path: "/repo/.pstdio/workspaces/PS-1",
        archived: false,
        workspace_shorthand: "PS-1",
        setup_error: null,
        created_at: "2026-06-01T08:00:00Z",
        updated_at: "2026-06-01T08:00:00Z",
        deleted_at: null,
      },
      {
        id: "workspace-2",
        project_id: "project-1",
        name: "Workspace two",
        branch: "workspace/PS-2",
        worktree_path: "/repo/.pstdio/workspaces/PS-2",
        archived: false,
        workspace_shorthand: "PS-2",
        setup_error: null,
        created_at: "2026-06-01T09:00:00Z",
        updated_at: "2026-06-01T09:00:00Z",
        deleted_at: null,
      },
    ]);
    getWriter("sessions")?.truncateAndWrite([
      {
        id: "session-one",
        project_id: "project-1",
        title: "Session one",
        status: "completed",
        agent: null,
        last_selected_model: null,
        archived: false,
        created_at: "2026-06-02T10:00:00Z",
        updated_at: "2026-06-02T10:00:00Z",
        deleted_at: null,
      },
      {
        id: "session-two",
        project_id: "project-1",
        title: "Session two",
        status: "completed",
        agent: null,
        last_selected_model: null,
        archived: false,
        created_at: "2026-06-02T11:00:00Z",
        updated_at: "2026-06-02T11:00:00Z",
        deleted_at: null,
      },
    ]);
    getWriter("workspace_sessions")?.truncateAndWrite([
      { id: "link-1", workspace_id: "workspace-1", session_id: "session-one" },
      { id: "link-2", workspace_id: "workspace-2", session_id: "session-two" },
    ]);

    const workbench = createWorkspaceSessionWorkbench();
    let displayed: Awaited<ReturnType<typeof workbench.renderers.getBody>> = [];
    const renderSidenav = async () => {
      displayed = await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav, {});
    };
    const refreshSubscription = workbench.renderers.onDidRefresh((event) => {
      if (event.treeId === dashboardWidgetIds.dashboardSidenav) void renderSidenav();
    });
    await renderSidenav();

    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const displayedSessionRowIds = () =>
      (displayed.flatMap((section) => section.nodes).find((node) => node.id === "workspace-sessions")?.children ?? [])
        .filter((node) => node.resource || node.target)
        .map((node) => node.id);
    const workspaceResource = (id: string) =>
      workbench.resources.listResources("").find((entry) => entry.resource.id === id)?.resource;

    await workbench.resources.openResource(workspaceResource("workspace-1")!, { replaceActive: true });
    workbench.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
    await flush();
    expect(displayedSessionRowIds()).toEqual(["dashboard-workbench://session/session-one"]);

    await workbench.resources.openResource(workspaceResource("workspace-2")!, { replaceActive: true });
    await flush();
    expect(displayedSessionRowIds()).toEqual(["dashboard-workbench://session/session-two"]);

    refreshSubscription.dispose();
  });
});
