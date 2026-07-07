import { describe, expect, test } from "bun:test";
import {
  createWorkbenchCore,
  resourceContextMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-workbench/core";
import {
  createWorkbenchTerminalModule,
  listWorkbenchMenuItems,
  WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
  WORKBENCH_TERMINAL_WIDGET_ID,
} from "pstdio-workbench/react";
import { dashboardCommandIds } from "../../shared/app/commands";
import { createDashboardResource } from "../../shared/app/resources";
import { registerWorkspaceResourceActions } from "./workspace-resource-actions";

const workspaceActionCommandIds = new Set<string>([
  dashboardCommandIds.openWorkspaceTerminal,
  dashboardCommandIds.renameWorkspace,
  dashboardCommandIds.archiveWorkspace,
  dashboardCommandIds.deleteWorkspace,
]);

describe("registerWorkspaceResourceActions", () => {
  test("keeps workspace header and context menu actions in the same kernel group", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule({
      id: "test.workspace-actions",
      activate: (ctx) => {
        registerWorkspaceResourceActions(ctx);
        return undefined;
      },
    });

    const headerActions = workbench.layout
      .listMenuItems(workbenchTopHeaderTrailingMenuPath)
      .filter((action) => workspaceActionCommandIds.has(action.commandId));
    const contextActions = workbench.layout
      .listMenuItems(resourceContextMenuPath("workspace"))
      .filter((action) => workspaceActionCommandIds.has(action.commandId));

    const expectedActions = [...workspaceActionCommandIds].map((commandId) => ({ commandId, group: "kernel" }));

    expect(headerActions.map((action) => ({ commandId: action.commandId, group: action.group }))).toEqual(
      expectedActions,
    );
    expect(contextActions.map((action) => ({ commandId: action.commandId, group: action.group }))).toEqual(
      expectedActions,
    );
  });

  test("opens a workspace terminal in the main-bottom panel", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
      workspaceShorthand: "PS-307_A1",
      workspaceType: "worktree",
    });

    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule({
      id: "test.workspace-actions",
      activate: (ctx) => {
        registerWorkspaceResourceActions(ctx);
        return undefined;
      },
    });
    workbench.panels.setOpen("secondary", false);

    await workbench.commands.executeCommand(dashboardCommandIds.openWorkspaceTerminal, undefined, {
      resource: workspace,
    });

    const secondaryArea = workbench.layout.getLayout().areas.secondary;
    expect(secondaryArea.activeWidgetId).toBe(WORKBENCH_TERMINAL_WIDGET_ID);
    const terminals = secondaryArea.widgets.filter(
      (placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID,
    );
    expect(secondaryArea.widgets.map((placement) => placement.contributionId)).toEqual([
      WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
      WORKBENCH_TERMINAL_WIDGET_ID,
    ]);
    expect(terminals).toEqual([
      expect.objectContaining({
        contributionId: WORKBENCH_TERMINAL_WIDGET_ID,
        mountStrategy: "keep-mounted",
        resource: workspace,
        title: "Terminal 1",
      }),
    ]);
    expect(workbench.panels.isOpen("secondary")).toBe(true);
  });

  test("leaves the workspace terminal action inert when the host terminal widget is unavailable", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
      workspaceShorthand: "PS-307_A1",
      workspaceType: "worktree",
    });

    workbench.registerModule({
      id: "test.workspace-actions",
      activate: (ctx) => {
        registerWorkspaceResourceActions(ctx);
        return undefined;
      },
    });

    await workbench.commands.executeCommand(dashboardCommandIds.openWorkspaceTerminal, undefined, {
      resource: workspace,
    });

    expect(workbench.layout.getLayout().areas.secondary.widgets).toEqual([]);
  });

  test("keeps terminal action visible for default and worktree workspace resources", () => {
    const workbench = createWorkbenchCore();
    const defaultWorkspace = createDashboardResource("workspace", "default", "project", "GitBranch", "project-1", {
      workspaceId: "default",
      workspaceIsDefault: true,
      workspaceShorthand: "default",
      workspaceType: "current_branch",
    });
    const worktreeWorkspace = createDashboardResource("workspace", "workspace-1", "WS-1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceIsDefault: false,
      workspacePath: "/repo/.pstdio/workspaces/WS-1",
      workspaceShorthand: "WS-1",
      workspaceType: "worktree",
    });

    workbench.registerModule({
      id: "test.workspace-actions",
      activate: (ctx) => {
        registerWorkspaceResourceActions(ctx);
        return undefined;
      },
    });

    const defaultLabels = listWorkbenchMenuItems(workbench, workbenchTopHeaderTrailingMenuPath, {
      resource: defaultWorkspace,
    }).map((item) => item.label);
    const worktreeLabels = listWorkbenchMenuItems(workbench, workbenchTopHeaderTrailingMenuPath, {
      resource: worktreeWorkspace,
    }).map((item) => item.label);

    expect(defaultLabels).toContain("Open terminal");
    expect(defaultLabels).not.toContain("Rename workspace");
    expect(worktreeLabels).toContain("Open terminal");
    expect(worktreeLabels).toContain("Rename workspace");
  });
});
