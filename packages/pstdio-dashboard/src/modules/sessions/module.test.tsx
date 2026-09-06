import { describe, expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey, selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage, openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionBubbleModule } from "./bubble/module";
import { createSessionsModule } from "./module";

describe("createSessionsModule", () => {
  test("registers the session resource kind", () => {
    const workbench = createWorkbench();

    workbench.registerModule(createSessionsModule());

    expect(workbench.resources.getKind("session")).toMatchObject({
      label: "Session",
      icon: "MessageCircle",
    });
    expect(workbench.views.getView(dashboardWidgetIds.session)).toBeDefined();
    expect(workbench.pages.getPage(dashboardViews.sessions.id)).toMatchObject({
      ref: workbenchPages.sessions,
      modeId: "sessions",
      path: "sessions",
    });
  });

  test("renders aggregate sessions in sessions mode and scoped sessions for a workspace resource", async () => {
    const workbench = createWorkbench();
    const workspace = createDashboardResource("workspace", "workspace-1", "Workspace one", "GitBranch", "project-1");
    const ticket = createDashboardResource("ticket", "ticket-1", "PS-1", "FileText", "project-1");

    workbench.registerModule(createSessionsModule());

    const nodeIdsForContext = async (mode: string, resource?: typeof workspace) =>
      (
        await workbench.navigationTrees.getSections(
          { kind: "mode", id: mode, extensionId: "pstdio" },
          "content",
          resource ? { resource } : {},
        )
      )
        .flatMap((section) => section.nodes)
        .map((node) => node.id);

    expect(await nodeIdsForContext("sessions")).toContain("workspace-sessions");
    expect(await nodeIdsForContext("project", workspace)).toContain("workspace-sessions");
    expect(await nodeIdsForContext("project", ticket)).not.toContain("workspace-sessions");
    expect(await nodeIdsForContext("project")).not.toContain("workspace-sessions");
  });

  test("adds sessions navigation as a sidenav section", async () => {
    const workbench = createWorkbench();

    workbench.registerModule(createSessionsModule());

    const sessionsNode = (
      await workbench.navigationTrees.getSections({ kind: "mode", id: "project", extensionId: "pstdio" })
    )
      .flatMap((section) => section.nodes)
      .find((node) => node.id === dashboardViews.sessions.id);

    expect(sessionsNode).toMatchObject({
      target: { kind: "page", page: workbenchPages.sessions },
    });
  });

  test("keeps the sessions root in the breadcrumb when a session opens", async () => {
    const workbench = createWorkbench();
    const session = createDashboardResource("session", "session-1", "My session", "MessageCircle", "project-1", {
      status: "completed",
    });

    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
    workbench.registerModule(createSessionsModule());

    openSessionsPage(workbench, session);

    expect(workbench.pages.store.getState().activePageId).toBe(workbenchPages.session.id);
    expect(workbench.layout.getLayout().regions.main.widgets[0]?.placementIdentity).toMatchObject({
      kind: "page",
      pageId: workbenchPages.session.id,
    });
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Sessions", "My session"]);
  });

  test("reuses the main tab when another session is selected", () => {
    const workbench = createWorkbench();
    const first = createDashboardResource("session", "session-1", "First session", "MessageCircle", "project-1");
    const second = createDashboardResource("session", "session-2", "Second session", "MessageCircle", "project-1");

    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
    workbench.registerModule(createSessionsModule());

    openSessionsPage(workbench, first);
    openSessionsPage(workbench, second);

    const mainTabs = workbench.layout.getLayout().regions.main.widgets;
    expect(mainTabs).toHaveLength(1);
    expect(mainTabs[0]?.resourceUri).toBe(second.uri);
  });

  test("updates the breadcrumb when starting a new session from sessions", async () => {
    const workbench = createWorkbench();
    const session = createDashboardResource("session", "session-1", "My session", "MessageCircle", "project-1", {
      status: "completed",
    });

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createSessionsModule());

    openSessionsPage(workbench, session);
    await workbench.commands.executeCommand(dashboardCommandIds.createSession);

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Sessions", "New session"]);
  });

  test("navigates back from a session to the sessions root", async () => {
    const workbench = createWorkbench();
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
    workbench.registerModule(createSessionsModule());

    openSessionsPage(workbench);
    openSessionsPage(workbench, session);

    workbench.pageLocations.goBack();
    await Promise.resolve();

    expect(workbench.pages.store.getState().location?.page).toEqual(workbenchPages.sessions);
    expect(workbench.layout.getActivePanel("main")?.viewId).toBe(dashboardWidgetIds.session);
    expect(workbench.layout.getLayout().activeResourceUri).toBeUndefined();
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.viewId)).toEqual([
      dashboardWidgetIds.session,
    ]);
    expect(workbench.layout.getLayout().regions.main.widgets[0]?.viewId).toBe(dashboardWidgetIds.session);

    workbench.pageLocations.goForward();
    await Promise.resolve();

    expect(workbench.pages.store.getState().location?.resource).toMatchObject({ type: "session", id: "session-2" });
    expect(workbench.layout.getLayout().activeResourceUri).toBe(session.uri);
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.viewId)).toEqual([
      dashboardWidgetIds.session,
    ]);
  });

  test("opens the project-owned sessions aggregate from global navigation", async () => {
    seedContractSessions();
    const workbench = createWorkbench();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.registerModule(createSessionsModule());

    await workbench.commands.executeCommand(dashboardCommandIds.openSessions);

    expect(workbench.layout.getLayout().regions.main.widgets[0]?.viewId).toBe(dashboardWidgetIds.session);
    expect(workbench.getPrimaryResource()).toBeUndefined();
  });

  test("returns to the last opened session from global navigation", async () => {
    seedContractSessions();
    const workbench = createWorkbench();
    const session = createDashboardResource("session", "session-2", "Second session", "MessageCircle", "project-1", {
      status: "completed",
    });

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.registerModule(createSessionsModule());

    openSessionsPage(workbench, session);
    await workbench.commands.executeCommand(dashboardCommandIds.openSessions);

    expect(workbench.layout.getLayout().activeResourceUri).toBe(session.uri);
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Sessions", "Second session"]);
  });

  test("opens command palette session resources in the project Session Panel", async () => {
    seedContractSessions();
    const workbench = createWorkbench();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.registerModule(createSessionBubbleModule());
    workbench.registerModule(createWorkspacesModule());
    workbench.registerModule(createSessionsModule());
    workbench.sidePanel.setMode("closed");
    openWorkspacesPage(workbench);

    const sessionEntry = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.uri === "pstdio://extension-resource/session/session-1");

    if (sessionEntry) await sessionEntry.activate?.(sessionEntry.resource);

    const layout = workbench.layout.getLayout();
    const bubblePlacement = layout.regions.side.widgets.find(
      (widget) => widget.resource?.uri === "pstdio://extension-resource/session/session-1",
    );

    expect(workbench.sidePanel.getMode()).toBe("attached");
    expect(bubblePlacement?.resource?.uri).toBe("pstdio://extension-resource/session/session-1");
    expect(workbench.modes.getActiveModeId()).not.toBe("sessions");
    expect(
      layout.regions.main.widgets.some(
        (widget) => widget.resource?.uri === "pstdio://extension-resource/session/session-1",
      ),
    ).toBe(false);
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
