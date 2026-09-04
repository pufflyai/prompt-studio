import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { createWorkbenchTerminalModule, WORKBENCH_TERMINAL_WIDGET_ID } from "@pstdio/workbench/react";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "./module";
import { ensureWorkspaceTerminalResource } from "./workspace-resource-actions";

describe("createWorkspacesModule terminal integration", () => {
  test("resolves the effective path when an alternate workspace resource omits it", async () => {
    const workbench = createWorkbench();
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
      openWorkspacesPage(workbench, workspace);

      const terminal = workbench.layout
        .listPanelInstances("secondary")
        .find((panel) => panel.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
      expect(terminal?.resource?.metadata).toMatchObject({ workspacePath: "/repo/prompt-studio" });
    } finally {
      getWriter("project_repos")?.truncateAndWrite([]);
      getWriter("repos")?.truncateAndWrite([]);
      getWriter("workspaces")?.truncateAndWrite([]);
    }
  });

  test("refreshes the effective path on a restored terminal placement", async () => {
    const workbench = createWorkbench();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-296_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceExecutionKind: "local",
      workspaceProviderState: "ready",
      workspaceShorthand: "PS-296_A1",
    });

    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-1",
        project_id: "project-1",
        name: "PS-296_A1",
        branch: "bugfix/ps-296",
        worktree_path: "/repo/.pstdio/workspaces/PS-296_A1",
        workspace_shorthand: "PS-296_A1",
        is_default: false,
      },
    ]);
    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    try {
      openWorkspacesPage(workbench, workspace);
      const opened = workbench.layout
        .listPanelInstances("secondary")
        .find((panel) => panel.viewId === WORKBENCH_TERMINAL_WIDGET_ID)!;
      workbench.layout.updatePanel(opened.instanceId, { resource: workspace, title: opened.title });

      ensureWorkspaceTerminalResource(workbench, workspace);

      const terminal = workbench.layout
        .listPanelInstances("secondary")
        .find((panel) => panel.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
      expect(terminal?.resource?.metadata).toMatchObject({
        workspacePath: "/repo/.pstdio/workspaces/PS-296_A1",
      });
    } finally {
      getWriter("workspaces")?.truncateAndWrite([]);
    }
  });

  test("opening a workspace ensures a terminal without reopening a closed Secondary Panel", async () => {
    const workbench = createWorkbench({ defaultPanelOpenByRegionId: { secondary: false } });
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

    openWorkspacesPage(workbench, workspace);
    openWorkspacesPage(workbench, workspace);

    const terminals = workbench.layout
      .listPanelInstances("secondary")
      .filter((panel) => panel.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(workbench.layout.listPanelInstances("secondary")).toHaveLength(1);
    expect(terminals).toEqual([
      expect.objectContaining({
        viewId: WORKBENCH_TERMINAL_WIDGET_ID,
        resource: expect.objectContaining({
          kind: "terminal",
          metadata: expect.objectContaining({ workspacePath: "/repo/.pstdio/workspaces/PS-307_A1" }),
        }),
        title: "Terminal 1",
      }),
    ]);
    expect(workbench.panels.isOpen("secondary")).toBe(false);
  });

  test("keeps the workspace terminal after navigating from the workspaces board", async () => {
    const workbench = createWorkbench();
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

    openWorkspacesPage(workbench);
    openWorkspacesPage(workbench, workspace);

    const terminals = workbench.layout
      .listPanelInstances("secondary")
      .filter((panel) => panel.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals).toEqual([
      expect.objectContaining({
        viewId: WORKBENCH_TERMINAL_WIDGET_ID,
        resource: expect.objectContaining({
          kind: "terminal",
          metadata: expect.objectContaining({ workspacePath: "/repo/.pstdio/workspaces/PS-307_A1" }),
        }),
        title: "Terminal 1",
      }),
    ]);
  });

  test("does not recreate a workspace terminal after it was closed", async () => {
    const workbench = createWorkbench();
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

    openWorkspacesPage(workbench, workspace);
    const terminal = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.placementIdentity?.kind === "shell");
    if (terminal?.placementIdentity) workbench.shellPlacements.closePlacement(terminal.placementIdentity);
    openWorkspacesPage(workbench);
    openWorkspacesPage(workbench, workspace);

    expect(
      workbench.layout
        .getLayout()
        .regions.secondary.widgets.some((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID),
    ).toBe(false);
  });

  test("keeps a closed auto-opened terminal closed without a launcher panel", async () => {
    const workbench = createWorkbench();
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

    openWorkspacesPage(workbench, workspace);
    const terminal = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.placementIdentity?.kind === "shell");
    if (terminal?.placementIdentity) workbench.shellPlacements.closePlacement(terminal.placementIdentity);
    openWorkspacesPage(workbench);
    openWorkspacesPage(workbench, workspace);

    expect(workbench.layout.listPanelInstances("secondary")).toEqual([]);
    expect(workbench.shellPlacements.getPlacement(WORKBENCH_TERMINAL_WIDGET_ID)).toBeDefined();
  });
});
