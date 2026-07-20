import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import type { DashboardSessionView } from "../data/dashboard-sessions";
import { openReviewWorkspace, openSelectedWorkspace } from "./session-chat-panel";

const sessionView = {
  id: "session-1",
  sessionId: "session-1",
  workspaceTitle: "Dashboard workbench datalayer",
  workspaceId: "workspace-1",
  workspaceBranch: "workspace/PS-307_A1",
  workspaceShorthand: "PS-307_A1",
  agent: null,
  lastSelectedModel: null,
  additions: 12,
  deletions: 3,
  messages: [],
} satisfies DashboardSessionView;

const registerWorkspaceOpener = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  workbench.resources.registerKind({ kind: "workspace", label: "Workspace", icon: "GitBranch" });
  workbench.modes.registerMode({ id: "workspace", label: "Workspace", activate: () => undefined });
  workbench.layout.registerWidget({
    id: dashboardWidgetIds.workspace,
    title: "Workspace",
    region: "main",
    rendererId: dashboardWidgetIds.workspace,
    singleton: true,
  });
  workbench.resources.registerOpener({
    id: "test.workspace.opener",
    priority: 1000,
    canOpen: (resource) => resource.kind === "workspace",
    open: (resource, input) => {
      workbench.modes.setActiveMode("workspace");
      return workbench.layout.openWidget(dashboardWidgetIds.workspace, {
        resource,
        title: resource.label,
        replaceActive: input.replaceActive,
      });
    },
  });
};

describe("openReviewWorkspace", () => {
  test("opens the linked workspace resource for review changes", async () => {
    const workbench = createWorkbenchCore();

    registerWorkspaceOpener(workbench);
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await openReviewWorkspace({ workbench }, sessionView);

    const mainPlacement = workbench.layout.getLayout().regions.main.widgets.find((placement) => {
      return placement.contributionId === dashboardWidgetIds.workspace;
    });

    expect(workbench.commandPalette.isOpen()).toBe(false);
    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe(dashboardWidgetIds.workspace);
    expect(mainPlacement?.resource).toMatchObject({
      kind: "workspace",
      id: "workspace-1",
      label: "Dashboard workbench datalayer",
      metadata: {
        workspaceId: "workspace-1",
        workspaceBranch: "workspace/PS-307_A1",
        workspaceShorthand: "PS-307_A1",
      },
    });
  });
});

describe("openSelectedWorkspace", () => {
  test("opens the selected workspace dropdown option", async () => {
    const workbench = createWorkbenchCore();

    registerWorkspaceOpener(workbench);
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await openSelectedWorkspace(
      { workbench },
      {
        id: "workspace-2",
        title: "Second attempt",
        shorthand: "PS-307_A2",
        branch: "workspace/PS-307_A2",
        type: "worktree",
        isDefault: false,
        updatedAt: "2026-05-22T08:55:00Z",
      },
      "project-1",
    );

    const mainPlacement = workbench.layout.getLayout().regions.main.widgets.find((placement) => {
      return placement.contributionId === dashboardWidgetIds.workspace;
    });

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe(dashboardWidgetIds.workspace);
    expect(mainPlacement?.resource).toMatchObject({
      kind: "workspace",
      id: "workspace-2",
      label: "Second attempt",
      metadata: {
        workspaceId: "workspace-2",
        workspaceBranch: "workspace/PS-307_A2",
        workspaceShorthand: "PS-307_A2",
        workspaceIsDefault: false,
      },
    });
  });
});
