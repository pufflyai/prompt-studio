import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { activateModeChromeContributions } from "@/shared/workbench/contributions/mode-chrome-contributions";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionBubbleModule } from "./module";

describe("createSessionBubbleModule", () => {
  test("mounts empty floating session chrome on activation", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionBubbleModule());

    const layout = workbench.layout.getLayout();

    expect(layout.areas.floating.widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.sessionBubble,
    ]);
    expect(layout.areas["floating-header"].widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.sessionBubbleHeader,
    ]);
    expect(layout.areas.floating.widgets[0]?.resource).toBeUndefined();
    expect(layout.areas["floating-header"].widgets[0]?.resource).toBeUndefined();
  });

  test("restores empty session chrome when mode chrome reactivates after floating areas are cleared", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionBubbleModule());
    workbench.sessionPanel.setMode("closed");
    workbench.layout.clearArea("floating");
    workbench.layout.clearArea("floating-header");

    activateModeChromeContributions(workbench, "workspace");
    const layout = workbench.layout.getLayout();

    expect(workbench.sessionPanel.getMode()).toBe("closed");
    expect(layout.areas.floating.widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.sessionBubble,
    ]);
    expect(layout.areas["floating-header"].widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.sessionBubbleHeader,
    ]);
  });

  test("opens a workspace-linked session draft from the create session command", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSessionBubbleModule());

    await workbench.commands.executeCommand(dashboardCommandIds.createSession, { workspace });

    const placement = workbench.layout
      .getLayout()
      .areas.floating.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble);

    expect(placement?.resource?.kind).toBe("session-draft");
    expect(placement?.resource?.metadata?.workspaceId).toBe("workspace-1");
    expect(placement?.resource?.metadata?.workspaceShorthand).toBe("PS-307_A1");
  });

  test("opens the session bubble header with the same draft resource", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSessionBubbleModule());

    await workbench.commands.executeCommand(dashboardCommandIds.createSession, { workspace });

    const headerPlacement = workbench.layout
      .getLayout()
      .areas["floating-header"].widgets.find(
        (widget) => widget.contributionId === dashboardWidgetIds.sessionBubbleHeader,
      );

    expect(headerPlacement?.resource?.kind).toBe("session-draft");
    expect(headerPlacement?.resource?.metadata?.workspaceId).toBe("workspace-1");
  });

  test("opens an unscoped session draft on the project default workspace", async () => {
    const workbench = createWorkbenchCore();

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
    workbench.registerModule(createSessionBubbleModule());

    try {
      await workbench.commands.executeCommand(dashboardCommandIds.createSession);

      const placement = workbench.layout
        .getLayout()
        .areas.floating.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble);

      expect(placement?.resource?.kind).toBe("session-draft");
      expect(placement?.resource?.metadata).toMatchObject({
        workspaceId: "workspace-default",
        workspaceTitle: "Root repo",
        workspaceShorthand: "ROOT",
        workspaceBranch: "main",
      });
    } finally {
      getWriter("workspaces")?.truncateAndWrite([]);
    }
  });

  test("opens an unscoped session draft on the active workspace in workspace mode", async () => {
    const workbench = createWorkbenchCore();

    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-default",
        project_id: "project-workspace-mode",
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
        project_id: "project-workspace-mode",
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
    selectDashboardProject(workbench, { id: "project-workspace-mode", name: "Prompt Studio" });
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createWorkspacesModule());

    try {
      const activeWorkspace = workbench.resources
        .listResources("")
        .find((entry) => entry.resource.id === "workspace-active")?.resource;

      await workbench.resources.openResource(activeWorkspace!, { replaceActive: true });
      await workbench.commands.executeCommand(dashboardCommandIds.createSession);

      const placement = workbench.layout
        .getLayout()
        .areas.floating.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble);

      expect(workbench.modes.getActiveModeId()).toBe("workspace");
      expect(workbench.getPrimaryResource()?.id).toBe("workspace-active");
      expect(placement?.resource?.kind).toBe("session-draft");
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
