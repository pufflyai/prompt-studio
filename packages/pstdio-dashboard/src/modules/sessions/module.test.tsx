import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { describeResourceRouteContract } from "@pstdio/workbench/testing";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey, selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { getSidebarContributionSections } from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { createSidebarModule } from "../sidebar/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionBubbleModule } from "./bubble/module";
import { createSessionsModule } from "./module";

describe("createSessionsModule", () => {
  test("registers the session resource kind", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionsModule());

    expect(workbench.resources.getKind("session")).toMatchObject({
      label: "Session",
      icon: "MessageCircle",
    });
  });

  test("renders the Sessions group in session and workspace modes but not the project mode", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionsModule());

    const nodeIdsForMode = (mode: string) =>
      getSidebarContributionSections(workbench, mode)
        .flatMap((section) => section.nodes)
        .map((node) => node.id);

    expect(nodeIdsForMode("project")).not.toContain("sessions");
    expect(nodeIdsForMode("sessions")).toContain("sessions");
    expect(nodeIdsForMode("workspace")).toContain("sessions");
  });

  test("adds sessions navigation to the project sidebar", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionsModule());

    const projectNodes = getSidebarContributionSections(workbench, "project").flatMap((section) => section.nodes);
    const sessionsNode = projectNodes.find((node) => node.id === dashboardResources.sessions.uri);

    expect(sessionsNode).toMatchObject({
      target: { kind: "command", commandId: dashboardCommandIds.openSessions },
    });
  });

  test("keeps the sessions root in the breadcrumb when a session opens", async () => {
    const workbench = createWorkbenchCore();
    const session = createDashboardResource("session", "session-1", "My session", "MessageCircle", "project-1", {
      status: "completed",
    });

    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
    workbench.registerModule(createSessionsModule());

    await workbench.resources.openResource(session);

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Sessions", "My session"]);
  });

  test("updates the breadcrumb when starting a new session from sessions", async () => {
    const workbench = createWorkbenchCore();
    const session = createDashboardResource("session", "session-1", "My session", "MessageCircle", "project-1", {
      status: "completed",
    });

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createSessionsModule());

    await workbench.resources.openResource(session);
    await workbench.commands.executeCommand(dashboardCommandIds.createSession);

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Sessions", "New session"]);
  });

  test("navigates back from a session to the sessions root", async () => {
    const workbench = createWorkbenchCore();
    const session = createDashboardResource("session", "session-2", "Second session", "MessageCircle", "project-1", {
      status: "completed",
    });

    getWriter("sessions")?.truncateAndWrite([
      {
        id: "session-1",
        project_id: "project-1",
        title: "First session",
        status: "completed",
        agent: null,
        last_selected_model: null,
        archived: false,
        created_at: "2026-06-01T10:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
        deleted_at: null,
      },
      {
        id: "session-2",
        project_id: "project-1",
        title: "Second session",
        status: "completed",
        agent: null,
        last_selected_model: null,
        archived: false,
        created_at: "2026-06-02T10:00:00Z",
        updated_at: "2026-06-02T10:00:00Z",
        deleted_at: null,
      },
    ]);
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createSessionsModule());

    await workbench.resources.openResource(dashboardResources.sessions);
    await workbench.resources.openResource(session, { replaceActive: true });

    const back = workbench.history.goBack();
    await Promise.resolve();

    expect(back?.resource?.uri).toBe(dashboardResources.sessions.uri);
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.session);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(dashboardResources.sessions.uri);
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.session,
    ]);
    expect(workbench.layout.getLayout().regions.main.widgets[0]?.resource?.kind).toBe("dashboard-view");

    const forward = workbench.history.goForward();
    await Promise.resolve();

    expect(forward?.resource?.uri).toBe(session.uri);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(session.uri);
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.session,
    ]);
  });

  test("opens the latest session when navigating sessions without a remembered session", async () => {
    seedContractSessions();
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createSessionsModule());

    await workbench.commands.executeCommand(dashboardCommandIds.openSessions);

    expect(workbench.layout.getLayout().activeResourceUri).toBe("dashboard-workbench://session/session-2");
  });

  test("opens the current Side Panel session when navigating sessions", async () => {
    seedContractSessions();
    const workbench = createWorkbenchCore();
    const currentSession = createDashboardResource(
      "session",
      "session-1",
      "First session",
      "MessageCircle",
      "project-1",
      {
        status: "completed",
      },
    );

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createSessionsModule());

    await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, { resource: currentSession });
    await workbench.commands.executeCommand(dashboardCommandIds.openSessions);

    expect(workbench.layout.getLayout().activeResourceUri).toBe(currentSession.uri);
  });

  test("opens command palette session resources in the floating bubble", async () => {
    seedContractSessions();
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createSessionsModule());
    workbench.sessionPanel.setMode("closed");

    const sessionEntry = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.uri === "dashboard-workbench://session/session-1");

    if (sessionEntry) await sessionEntry.activate?.(sessionEntry.resource);

    const layout = workbench.layout.getLayout();
    const bubblePlacement = layout.regions.side.widgets.find(
      (widget) => widget.contributionId === dashboardWidgetIds.sessionBubble,
    );

    expect(workbench.sessionPanel.getMode()).toBe("bubble");
    expect(bubblePlacement?.resource?.uri).toBe("dashboard-workbench://session/session-1");
    expect(workbench.modes.getActiveModeId()).not.toBe("sessions");
    expect(
      layout.regions.main.widgets.some((widget) => widget.resource?.uri === "dashboard-workbench://session/session-1"),
    ).toBe(false);
  });
});

describe("createSessionsModule workspace session scoping", () => {
  test("scopes the workspace-mode session list to the open workspace", async () => {
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

    const workbench = createWorkbenchCore();
    workbench.registerModule(createSidebarModule());
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createWorkspacesModule());
    workbench.registerModule(createSessionsModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    const workspace = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.kind === "workspace")?.resource;
    await workbench.resources.openResource(workspace!, { replaceActive: true });

    const sessionsGroup = (await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidebar, {}))
      .flatMap((section) => section.nodes)
      .find((node) => node.id === "sessions");
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

    const workbench = createWorkbenchCore();
    workbench.registerModule(createSidebarModule());
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createWorkspacesModule());
    workbench.registerModule(createSessionsModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    // Mirror the live sidebar widget: its React effect only recomputes getBody on refresh events
    // (its deps don't include the primary resource), so scoping is only correct if a refresh fires
    // while the switched-to workspace is the primary resource.
    let displayed: Awaited<ReturnType<typeof workbench.renderers.getBody>> = [];
    const renderSidebar = async () => {
      displayed = await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidebar, {});
    };
    const refreshSubscription = workbench.renderers.onDidRefresh((event) => {
      if (event.treeId === dashboardWidgetIds.dashboardSidebar) void renderSidebar();
    });
    await renderSidebar();

    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const displayedSessionRowIds = () =>
      (displayed.flatMap((section) => section.nodes).find((node) => node.id === "sessions")?.children ?? [])
        .filter((node) => node.resource || node.target)
        .map((node) => node.id);
    const workspaceResource = (id: string) =>
      workbench.resources.listResources("").find((entry) => entry.resource.id === id)?.resource;

    await workbench.resources.openResource(workspaceResource("workspace-1")!, { replaceActive: true });
    // A data-sync refresh accompanies entering a freshly opened/created workspace, so the first
    // workspace scopes correctly; simulate that settled state before the pure switch.
    workbench.renderers.refresh(dashboardWidgetIds.dashboardSidebar);
    await flush();
    expect(displayedSessionRowIds()).toEqual(["dashboard-workbench://session/session-one"]);

    await workbench.resources.openResource(workspaceResource("workspace-2")!, { replaceActive: true });
    await flush();
    expect(displayedSessionRowIds()).toEqual(["dashboard-workbench://session/session-two"]);

    refreshSubscription.dispose();
  });
});

const seedContractSessions = () =>
  getWriter("sessions")?.truncateAndWrite([
    {
      id: "session-1",
      project_id: "project-1",
      title: "First session",
      status: "completed",
      agent: null,
      last_selected_model: null,
      archived: false,
      created_at: "2026-06-01T10:00:00Z",
      updated_at: "2026-06-01T10:00:00Z",
      deleted_at: null,
    },
    {
      id: "session-2",
      project_id: "project-1",
      title: "Second session",
      status: "completed",
      agent: null,
      last_selected_model: null,
      archived: false,
      created_at: "2026-06-02T10:00:00Z",
      updated_at: "2026-06-02T10:00:00Z",
      deleted_at: null,
    },
  ]);

describeResourceRouteContract({
  name: "sessions",
  setup: () => {
    seedContractSessions();
    const workbench = createWorkbenchCore();
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createSessionsModule());
    return { workbench };
  },
  root: dashboardResources.sessions,
  detail: createDashboardResource("session", "session-1", "First session", "MessageCircle", "project-1", {
    status: "completed",
  }),
  detailB: createDashboardResource("session", "session-2", "Second session", "MessageCircle", "project-1", {
    status: "completed",
  }),
  rootDetailHistory: "retained",
  expectedMode: "sessions",
});
