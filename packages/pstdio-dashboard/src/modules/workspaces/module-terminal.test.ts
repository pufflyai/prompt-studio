import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import {
  createWorkbenchTerminalModule,
  WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
  WORKBENCH_TERMINAL_WIDGET_ID,
} from "@pstdio/workbench/react";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { createWorkspacesModule } from "./module";

describe("createWorkspacesModule terminal integration", () => {
  test("opening a workspace ensures a workspace terminal in the main-bottom area", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
      workspaceShorthand: "PS-307_A1",
      workspaceType: "worktree",
    });

    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.panels.setOpen("secondary", false);

    await workbench.resources.openResource(workspace, { replaceActive: true });
    await workbench.resources.openResource(workspace, { replaceActive: true });

    const secondaryArea = workbench.layout.getLayout().areas.secondary;
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
        resource: workspace,
        title: "Terminal 1",
      }),
    ]);
    expect(workbench.panels.isOpen("secondary")).toBe(true);
  });

  test("keeps the workspace terminal after navigating from the workspaces board", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
      workspaceShorthand: "PS-307_A1",
      workspaceType: "worktree",
    });

    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });
    await workbench.resources.openResource(workspace, { replaceActive: true });

    const secondaryArea = workbench.layout.getLayout().areas.secondary;
    const terminals = secondaryArea.widgets.filter(
      (placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID,
    );
    expect(terminals).toEqual([
      expect.objectContaining({
        contributionId: WORKBENCH_TERMINAL_WIDGET_ID,
        resource: workspace,
        title: "Terminal 1",
      }),
    ]);
  });

  test("does not recreate a workspace terminal after it was closed", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
      workspaceShorthand: "PS-307_A1",
      workspaceType: "worktree",
    });

    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });
    workbench.layout.closeWidget(WORKBENCH_TERMINAL_WIDGET_ID);
    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });
    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(
      workbench.layout
        .getLayout()
        .areas.secondary.widgets.some((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID),
    ).toBe(false);
  });

  test("keeps the terminal launcher available after an auto-opened terminal was closed", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
      workspaceShorthand: "PS-307_A1",
      workspaceType: "worktree",
    });

    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });
    workbench.layout.closeWidget(WORKBENCH_TERMINAL_WIDGET_ID);
    workbench.layout.clearArea("secondary");
    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });
    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(workbench.layout.getLayout().areas.secondary.widgets).toEqual([
      expect.objectContaining({
        contributionId: WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
        hiddenByDefault: true,
      }),
    ]);
  });
});
