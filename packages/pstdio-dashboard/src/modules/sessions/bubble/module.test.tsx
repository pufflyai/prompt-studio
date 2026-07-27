import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { activateModeChromeContributions } from "@/shared/workbench/contributions/mode-chrome-contributions";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionBubbleModule } from "./module";

describe("createSessionBubbleModule", () => {
  test("registers the Session Panel for project home without opening a rogue tab", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionBubbleModule());

    const layout = workbench.layout.getLayout();

    expect(layout.regions.side.widgets).toEqual([]);
    expect(layout.regions["side-header"].widgets).toEqual([]);
    const contribution = workbench.layout.getPanel(dashboardWidgetIds.sessionBubble);
    expect(contribution).toMatchObject({
      region: "side",
      closable: true,
      eligibleLocations: { resourceKinds: ["dashboard-view", "ticket", "workspace"] },
      openCommandId: dashboardCommandIds.createSession,
      tab: {
        contentRendererId: "dashboard-workbench.session-tab",
        customMenuRendererId: "dashboard-workbench.session-tab-menu",
      },
    });
    expect(contribution?.eligibleLocations?.canOpen?.(dashboardResources.sessions)).toBe(false);
    expect(contribution?.eligibleLocations?.canOpen?.(dashboardResources.start)).toBe(true);
  });

  test("does not synthesize a session tab when mode chrome reactivates", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionBubbleModule());
    workbench.sidePanel.setMode("closed");
    workbench.layout.clearRegion("side");
    workbench.layout.clearRegion("side-header");

    activateModeChromeContributions(workbench, "workspace");
    const layout = workbench.layout.getLayout();

    expect(workbench.sidePanel.getMode()).toBe("closed");
    expect(layout.regions.side.widgets).toEqual([]);
    expect(layout.regions["side-header"].widgets).toEqual([]);
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
      .regions.side.widgets.find((widget) => widget.resource?.kind === "session-draft");

    expect(placement?.resource?.kind).toBe("session-draft");
    expect(placement?.resource?.metadata?.workspaceId).toBe("workspace-1");
    expect(placement?.resource?.metadata?.workspaceShorthand).toBe("PS-307_A1");
  });

  test("reuses the selected Session Sub Panel for session changes and new drafts", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });
    const firstSession = createDashboardResource("session", "session-1", "First session", "MessageCircle", "project-1");
    const secondSession = createDashboardResource(
      "session",
      "session-2",
      "Second session",
      "MessageCircle",
      "project-1",
    );

    workbench.registerModule(createSessionBubbleModule());

    const firstPlacement = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: firstSession,
    });
    const secondPlacement = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: secondSession,
    });
    await workbench.commands.executeCommand(dashboardCommandIds.createSession, { workspace });

    const placements = workbench.layout
      .getLayout()
      .regions.side.widgets.filter((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble);

    expect(placements).toHaveLength(1);
    expect((firstPlacement as { instanceId: string }).instanceId).toBe(
      (secondPlacement as { instanceId: string }).instanceId,
    );
    expect(placements[0]?.widgetId).toBe((firstPlacement as { instanceId: string }).instanceId);
    expect(placements[0]?.resource?.kind).toBe("session-draft");
    expect(placements[0]?.closable).toBe(true);
  });

  test("creates another Session Sub Panel only for an Add Panel request", async () => {
    const workbench = createWorkbenchCore();
    const firstSession = createDashboardResource("session", "session-1", "First session", "MessageCircle", "project-1");
    const secondSession = createDashboardResource(
      "session",
      "session-2",
      "Second session",
      "MessageCircle",
      "project-1",
    );
    workbench.registerModule(createSessionBubbleModule());

    const firstPlacement = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: firstSession,
    });
    const addedPlacement = await workbench.commands.executeCommand(dashboardCommandIds.createSession, undefined, {
      source: "panel-add",
    });
    const selectedPlacement = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: secondSession,
    });
    const placements = workbench.layout
      .getLayout()
      .regions.side.widgets.filter((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble);

    expect(placements).toHaveLength(2);
    expect((addedPlacement as { instanceId: string }).instanceId).not.toBe(
      (firstPlacement as { instanceId: string }).instanceId,
    );
    expect((selectedPlacement as { instanceId: string }).instanceId).toBe(
      (addedPlacement as { instanceId: string }).instanceId,
    );
    expect(
      placements.find((placement) => placement.widgetId === (selectedPlacement as { instanceId: string }).instanceId),
    ).toMatchObject({ resourceUri: secondSession.uri });
  });
});

describe("createSessionBubbleModule workspace resolution", () => {
  test("contributes New session through explicit Sub Panel registration", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionBubbleModule());

    expect(workbench.layout.getPanel(dashboardWidgetIds.sessionBubble)).toMatchObject({
      closable: true,
      region: "side",
      openCommandId: dashboardCommandIds.createSession,
    });
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
        .regions.side.widgets.find((widget) => widget.resource?.kind === "session-draft");

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
        .regions.side.widgets.find((widget) => widget.resource?.kind === "session-draft");

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
