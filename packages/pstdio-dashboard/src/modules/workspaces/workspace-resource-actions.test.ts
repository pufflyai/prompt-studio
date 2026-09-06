import { describe, expect, test } from "bun:test";
import { createWorkbench, resourceContextMenuPath, workbenchTopHeaderTrailingMenuPath } from "@pstdio/workbench";
import {
  createWorkbenchTerminalModule,
  listWorkbenchMenuItems,
  WORKBENCH_TERMINAL_WIDGET_ID,
} from "@pstdio/workbench/react";
import { dashboardCommandIds } from "../../shared/app/commands";
import { createDashboardResource } from "../../shared/app/resources";
import { ensureWorkspaceTerminalResource, registerWorkspaceResourceActions } from "./workspace-resource-actions";

const workspaceActionCommandIds = new Set<string>([
  dashboardCommandIds.openWorkspaceTerminal,
  dashboardCommandIds.renameWorkspace,
  dashboardCommandIds.archiveWorkspace,
  dashboardCommandIds.deleteWorkspace,
]);

describe("registerWorkspaceResourceActions", () => {
  test("registers workspace actions only beside workspace resources", () => {
    const workbench = createWorkbench();

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

    expect(headerActions).toEqual([]);
    expect(contextActions.map((action) => ({ commandId: action.commandId, group: action.group }))).toEqual(
      expectedActions,
    );
  });

  test("opens a workspace terminal in the Secondary Panel", async () => {
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
    workbench.registerModule({
      id: "test.workspace-actions",
      activate: (ctx) => {
        registerWorkspaceResourceActions(ctx);
        return undefined;
      },
    });
    workbench.shell.setRegionOpen("secondary", false);

    await workbench.commands.executeCommand(dashboardCommandIds.openWorkspaceTerminal, undefined, {
      resource: workspace,
    });

    const secondaryRegion = workbench.layout.getLayout().regions.secondary;
    expect(
      secondaryRegion.widgets.find((placement) => placement.widgetId === secondaryRegion.activeWidgetId)?.viewId,
    ).toBe(WORKBENCH_TERMINAL_WIDGET_ID);
    const terminals = workbench.layout
      .listPanelInstances("secondary")
      .filter((panel) => panel.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(secondaryRegion.widgets).toHaveLength(1);
    expect(terminals).toEqual([
      expect.objectContaining({
        viewId: WORKBENCH_TERMINAL_WIDGET_ID,
        mountStrategy: "keep-mounted",
        resource: expect.objectContaining({ kind: "terminal", metadata: workspace.metadata }),
        title: "Terminal 1",
      }),
    ]);
    expect(workbench.shell.getRegionState("secondary").open).toBe(true);
  });

  test("leaves the workspace terminal action inert when the host terminal widget is unavailable", async () => {
    const workbench = createWorkbench();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceExecutionKind: "local",
      workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
      workspaceProviderState: "ready",
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

    expect(workbench.layout.getLayout().regions.secondary.widgets).toEqual([]);
  });

  test("restores an owned workspace terminal missing from the rendered layout", () => {
    const workbench = createWorkbench();
    const workspace = createDashboardResource("workspace", "workspace-1", "WS-1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceExecutionKind: "local",
      workspacePath: "/repo/.pstdio/workspaces/WS-1",
      workspaceProviderState: "ready",
    });
    workbench.registerModule(createWorkbenchTerminalModule());
    ensureWorkspaceTerminalResource(workbench, workspace);
    const terminal = workbench.layout.listPanelInstances("secondary")[0];
    workbench.layout.removeWidgetPlacement(terminal.instanceId);

    ensureWorkspaceTerminalResource(workbench, workspace);

    expect(workbench.layout.listPanelInstances("secondary")).toEqual([
      expect.objectContaining({
        viewId: WORKBENCH_TERMINAL_WIDGET_ID,
        resource: expect.objectContaining({ metadata: expect.objectContaining({ workspaceId: "workspace-1" }) }),
      }),
    ]);
  });

  test("keeps terminal action visible for default and worktree workspace resources", () => {
    const workbench = createWorkbench();
    const defaultWorkspace = createDashboardResource("workspace", "default", "project", "GitBranch", "project-1", {
      workspaceId: "default",
      workspaceExecutionKind: "local",
      workspaceIsDefault: true,
      workspaceProviderState: "ready",
      workspaceShorthand: "default",
      workspaceType: "current_branch",
    });
    const worktreeWorkspace = createDashboardResource("workspace", "workspace-1", "WS-1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceExecutionKind: "local",
      workspaceIsDefault: false,
      workspacePath: "/repo/.pstdio/workspaces/WS-1",
      workspaceProviderState: "ready",
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

    const defaultLabels = listWorkbenchMenuItems(workbench, resourceContextMenuPath("workspace"), {
      resource: defaultWorkspace,
    }).map((item) => item.label);
    const worktreeLabels = listWorkbenchMenuItems(workbench, resourceContextMenuPath("workspace"), {
      resource: worktreeWorkspace,
    }).map((item) => item.label);

    expect(defaultLabels).toContain("Open terminal");
    expect(defaultLabels).not.toContain("Rename workspace");
    expect(worktreeLabels).toContain("Open terminal");
    expect(worktreeLabels).toContain("Rename workspace");
  });
});
