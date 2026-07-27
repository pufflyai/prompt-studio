import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { describeResourceRouteContract } from "@pstdio/workbench/testing";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardActiveCollection, getDashboardSelectedResource } from "@/shared/app/navigation-state";
import { dashboardSelectedProjectIdContextKey, selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  getSidenavContributionHeaderNodes,
  getSidenavContributionSections,
} from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { createSidenavModule } from "../sidenav/module";
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
    expect(workbench.layout.getWidget(dashboardWidgetIds.session)).toMatchObject({ floatingPanels: "hidden" });
  });

  test("renders the Sessions group in session and workspace modes but not the project mode", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionsModule());

    const nodeIdsForMode = async (mode: string) =>
      (await getSidenavContributionSections(workbench, mode))
        .flatMap((section) => section.nodes)
        .map((node) => node.id);

    expect(await nodeIdsForMode("project")).not.toContain("sessions");
    expect(await nodeIdsForMode("sessions")).toContain("sessions");
    expect(await nodeIdsForMode("workspace")).toContain("sessions");
  });

  test("adds sessions navigation to the persistent sidenav header", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionsModule());

    const sessionsNode = getSidenavContributionHeaderNodes(workbench, "project").find(
      (node) => node.id === dashboardResources.sessions.uri,
    );

    expect(sessionsNode).toMatchObject({
      target: { kind: "command", commandId: dashboardCommandIds.openSessions },
    });
    expect(
      (await getSidenavContributionSections(workbench, "project"))
        .flatMap((section) => section.nodes)
        .map((node) => node.id),
    ).not.toContain(dashboardResources.sessions.uri);
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

  test("opens the project-owned sessions aggregate from global navigation", async () => {
    seedContractSessions();
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createSessionsModule());

    await workbench.commands.executeCommand(dashboardCommandIds.openSessions);

    expect(workbench.layout.getLayout().regions.main.widgets[0]?.resource?.uri).toBe(dashboardResources.sessions.uri);
    expect(getDashboardActiveCollection(workbench)).toBe("sessions");
    expect(getDashboardSelectedResource(workbench)).toBeUndefined();
  });

  test("returns to the last opened session from global navigation", async () => {
    seedContractSessions();
    const workbench = createWorkbenchCore();
    const session = createDashboardResource("session", "session-2", "Second session", "MessageCircle", "project-1", {
      status: "completed",
    });

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createSessionsModule());

    await workbench.resources.openResource(session);
    await workbench.commands.executeCommand(dashboardCommandIds.openSessions);

    expect(workbench.layout.getLayout().activeResourceUri).toBe(session.uri);
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Sessions", "Second session"]);
  });

  test("opens command palette session resources in the floating Side Panel", async () => {
    seedContractSessions();
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createSessionsModule());
    workbench.sidePanel.setMode("closed");

    const sessionEntry = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.uri === "dashboard-workbench://session/session-1");

    if (sessionEntry) await sessionEntry.activate?.(sessionEntry.resource);

    const layout = workbench.layout.getLayout();
    const bubblePlacement = layout.regions.side.widgets.find(
      (widget) => widget.resource?.uri === "dashboard-workbench://session/session-1",
    );

    expect(workbench.sidePanel.getMode()).toBe("floating");
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
    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createWorkspacesModule());
    workbench.registerModule(createSessionsModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    const workspace = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.kind === "workspace")?.resource;
    await workbench.resources.openResource(workspace!, { replaceActive: true });

    const sessionsGroup = (await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav, {}))
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
    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createWorkspacesModule());
    workbench.registerModule(createSessionsModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    // Mirror the live sidenav widget: its React effect only recomputes getBody on refresh events
    // (its deps don't include the primary resource), so scoping is only correct if a refresh fires
    // while the switched-to workspace is the primary resource.
    let displayed: Awaited<ReturnType<typeof workbench.renderers.getBody>> = [];
    const renderSidenav = async () => {
      displayed = await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav, {});
    };
    const refreshSubscription = workbench.renderers.onDidRefresh((event) => {
      if (event.treeId === dashboardWidgetIds.dashboardSidenav) void renderSidenav();
    });
    await renderSidenav();

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
    workbench.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
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
