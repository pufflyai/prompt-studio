import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import {
  createWorkbenchTerminalModule,
  WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
  WORKBENCH_TERMINAL_WIDGET_ID,
} from "@pstdio/workbench/react";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardViews } from "@/shared/app/resources";
import { createWorkspacesModule } from "./module";

describe("createWorkspacesModule terminal integration", () => {
  test("resolves the effective path when an alternate workspace resource omits it", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "Root repo", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceExecutionKind: "local",
      workspaceProviderState: "ready",
      workspaceShorthand: "ROOT",
    });

    getWriter("project_repos")?.truncateAndWrite([
      { id: "project-repo-1", project_id: "project-1", repo_id: "repo-1" },
    ]);
    getWriter("repos")?.truncateAndWrite([{ id: "repo-1", path: "/repo/prompt-studio" }]);
    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-1",
        project_id: "project-1",
        name: "Root repo",
        branch: "main",
        worktree_path: null,
        workspace_shorthand: "ROOT",
        is_default: true,
      },
    ]);
    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    try {
      await workbench.resources.openResource(workspace, { replaceActive: true });

      const terminal = workbench.layout
        .listPanelInstances("secondary")
        .find((panel) => panel.panelId === WORKBENCH_TERMINAL_WIDGET_ID);
      expect(terminal?.resource?.metadata).toMatchObject({ workspacePath: "/repo/prompt-studio" });
    } finally {
      getWriter("project_repos")?.truncateAndWrite([]);
      getWriter("repos")?.truncateAndWrite([]);
      getWriter("workspaces")?.truncateAndWrite([]);
    }
  });

  test("opening a workspace ensures a terminal without reopening a closed Secondary Panel", async () => {
    const workbench = createWorkbenchCore({ defaultPanelOpenByRegionId: { secondary: false } });
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceExecutionKind: "local",
      workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
      workspaceProviderState: "ready",
      workspaceShorthand: "PS-307_A1",
      workspaceType: "worktree",
    });
    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.panels.setOpen("secondary", false);

    await workbench.resources.openResource(workspace, { replaceActive: true });
    await workbench.resources.openResource(workspace, { replaceActive: true });

    const terminals = workbench.layout
      .listPanelInstances("secondary")
      .filter((panel) => panel.panelId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(workbench.layout.listPanelInstances("secondary").map((panel) => panel.panelId)).toEqual([
      WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
      WORKBENCH_TERMINAL_WIDGET_ID,
    ]);
    expect(terminals).toEqual([
      expect.objectContaining({
        panelId: WORKBENCH_TERMINAL_WIDGET_ID,
        resource: workspace,
        title: "Terminal 1",
      }),
    ]);
    expect(workbench.panels.isOpen("secondary")).toBe(false);
  });

  test("keeps the workspace terminal after navigating from the workspaces board", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceExecutionKind: "local",
      workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
      workspaceProviderState: "ready",
      workspaceShorthand: "PS-307_A1",
      workspaceType: "worktree",
    });
    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.views.openView(dashboardViews.workspaces.id, { strategy: { kind: "replace-active" } });
    await workbench.resources.openResource(workspace, { replaceActive: true });

    const terminals = workbench.layout
      .listPanelInstances("secondary")
      .filter((panel) => panel.panelId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals).toEqual([
      expect.objectContaining({
        panelId: WORKBENCH_TERMINAL_WIDGET_ID,
        resource: workspace,
        title: "Terminal 1",
      }),
    ]);
  });

  test("does not recreate a workspace terminal after it was closed", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceExecutionKind: "local",
      workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
      workspaceProviderState: "ready",
      workspaceShorthand: "PS-307_A1",
      workspaceType: "worktree",
    });
    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });
    workbench.layout.closePanel(WORKBENCH_TERMINAL_WIDGET_ID);
    await workbench.views.openView(dashboardViews.workspaces.id, { strategy: { kind: "replace-active" } });
    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(
      workbench.layout
        .getLayout()
        .regions.secondary.widgets.some((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID),
    ).toBe(false);
  });

  test("keeps the terminal launcher available after an auto-opened terminal was closed", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceExecutionKind: "local",
      workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
      workspaceProviderState: "ready",
      workspaceShorthand: "PS-307_A1",
      workspaceType: "worktree",
    });
    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });
    workbench.layout.closePanel(WORKBENCH_TERMINAL_WIDGET_ID);
    workbench.layout.clearRegion("secondary");
    await workbench.views.openView(dashboardViews.workspaces.id, { strategy: { kind: "replace-active" } });
    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(workbench.layout.listPanelInstances("secondary")).toEqual([
      expect.objectContaining({
        panelId: WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
        hiddenByDefault: true,
      }),
    ]);
  });
});
