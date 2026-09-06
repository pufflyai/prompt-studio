import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionBubbleModule } from "./module";

describe("createSessionBubbleModule workspace resolution", () => {
  test("registers the New session side panel", () => {
    const workbench = createWorkbench();
    workbench.registerModule(createSessionBubbleModule());
    expect(workbench.modePlacements.listPlacements("project")[0]).toMatchObject({
      region: "side",
      item: {
        kind: "binding",
        binding: expect.objectContaining({
          add: {
            kind: "command",
            target: { command: { kind: "command", extensionId: "pstdio", id: dashboardCommandIds.createSession } },
          },
        }),
      },
    });
    expect(workbench.views.getView(dashboardWidgetIds.sessionBubble)).toBeDefined();
  });
  test("opens an unscoped session draft on the project default workspace", async () => {
    const workbench = createWorkbench();
    getWriter("project_repos")?.truncateAndWrite([
      { id: "project-repo-1", project_id: "project-default-workspace", repo_id: "repo-1" },
    ]);
    getWriter("repos")?.truncateAndWrite([{ id: "repo-1", path: "/repo/prompt-studio" }]);
    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-default",
        project_id: "project-default-workspace",
        name: "Root repo",
        branch: "main",
        archived: false,
        workspace_shorthand: "ROOT",
        is_default: true,
        created_at: "2026-06-01T10:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
        deleted_at: null,
      },
      {
        id: "workspace-newer",
        project_id: "project-default-workspace",
        name: "Feature branch",
        branch: "feature/newer",
        archived: false,
        workspace_shorthand: "PS-1_A1",
        is_default: false,
        created_at: "2026-06-02T10:00:00Z",
        updated_at: "2026-06-02T10:00:00Z",
        deleted_at: null,
      },
    ]);
    selectDashboardProject(workbench, { id: "project-default-workspace", name: "Prompt Studio" });
    workbench.registerModule(createWorkspacesModule());
    workbench.registerModule(createSessionBubbleModule());
    try {
      openWorkspacesPage(workbench);
      await workbench.commands.executeCommand(dashboardCommandIds.createSession);
      const placement = workbench.layout
        .getLayout()
        .regions.side.widgets.find((widget) => widget.resource?.type === "session-draft");
      expect(placement?.resource?.type).toBe("session-draft");
      expect(placement?.resource?.metadata).toMatchObject({
        workspaceId: "workspace-default",
        workspaceTitle: "Root repo",
        workspaceShorthand: "ROOT",
        workspaceBranch: "main",
        workspacePath: "/repo/prompt-studio",
      });
    } finally {
      getWriter("project_repos")?.truncateAndWrite([]);
      getWriter("repos")?.truncateAndWrite([]);
      getWriter("workspaces")?.truncateAndWrite([]);
    }
  });
  test("opens an unscoped session draft on the primary workspace resource", async () => {
    const workbench = createWorkbench();
    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-default",
        project_id: "project-workspace-resource",
        name: "Root repo",
        branch: "main",
        archived: false,
        workspace_shorthand: "ROOT",
        is_default: true,
        created_at: "2026-06-01T10:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
        deleted_at: null,
      },
      {
        id: "workspace-active",
        project_id: "project-workspace-resource",
        name: "Active workspace",
        branch: "workspace/PS-307_A1",
        worktree_path: "/repo/.pstdio/workspaces/PS-307_A1",
        archived: false,
        workspace_shorthand: "PS-307_A1",
        is_default: false,
        created_at: "2026-06-02T10:00:00Z",
        updated_at: "2026-06-02T10:00:00Z",
        deleted_at: null,
      },
    ]);
    selectDashboardProject(workbench, { id: "project-workspace-resource", name: "Prompt Studio" });
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createWorkspacesModule());
    try {
      const activeWorkspace = workbench.resources
        .listResources("")
        .find((entry) => entry.resource.id === "workspace-active")?.resource;
      openWorkspacesPage(workbench, activeWorkspace!);
      await workbench.commands.executeCommand(dashboardCommandIds.createSession);
      const placement = workbench.layout
        .getLayout()
        .regions.side.widgets.find((widget) => widget.resource?.type === "session-draft");
      expect(workbench.modes.getActiveModeId()).toBe("project");
      expect(workbench.getPrimaryResource()?.id).toBe("workspace-active");
      expect(placement?.resource?.type).toBe("session-draft");
      expect(placement?.resource?.metadata).toMatchObject({
        workspaceId: "workspace-active",
        workspaceTitle: "Active workspace",
        workspaceShorthand: "PS-307_A1",
        workspaceBranch: "workspace/PS-307_A1",
      });
    } finally {
      getWriter("workspaces")?.truncateAndWrite([]);
    }
  });
});
