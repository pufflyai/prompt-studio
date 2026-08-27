import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardActiveCollection, getDashboardSelectedResource } from "@/shared/app/navigation-state";
import { dashboardSelectedProjectIdContextKey, selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  getSidenavContributionHeaderNodes,
  getSidenavContributionSections,
} from "@/shared/workbench/contributions/sidenav-tree-contributions";
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
    expect(workbench.layout.getPanel(dashboardWidgetIds.session)).toMatchObject({ floatingPanels: "hidden" });
  });

  test("renders aggregate sessions in sessions mode and scoped sessions for a workspace resource", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "Workspace one", "GitBranch", "project-1");
    const ticket = createDashboardResource("ticket", "ticket-1", "PS-1", "FileText", "project-1");

    workbench.registerModule(createSessionsModule());

    const nodeIdsForContext = async (mode: string, resource?: typeof workspace) =>
      (await getSidenavContributionSections(workbench, mode, resource ? { resource } : {}))
        .flatMap((section) => section.nodes)
        .map((node) => node.id);

    expect(await nodeIdsForContext("sessions")).toContain("workspace-sessions");
    expect(await nodeIdsForContext("project", workspace)).toContain("workspace-sessions");
    expect(await nodeIdsForContext("project", ticket)).not.toContain("workspace-sessions");
    expect(await nodeIdsForContext("project")).not.toContain("workspace-sessions");
  });

  test("adds sessions navigation to the persistent sidenav header", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createSessionsModule());

    const sessionsNode = getSidenavContributionHeaderNodes(workbench, "project").find(
      (node) => node.id === dashboardViews.sessions.id,
    );

    expect(sessionsNode).toMatchObject({
      target: { kind: "view", viewId: dashboardViews.sessions.id },
    });
    expect(
      (await getSidenavContributionSections(workbench, "project"))
        .flatMap((section) => section.nodes)
        .map((node) => node.id),
    ).not.toContain(dashboardViews.sessions.id);
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
    workbench.registerModule(createSessionsModule());

    await workbench.views.openView(dashboardViews.sessions.id);
    await workbench.resources.openResource(session, { replaceActive: true });

    const back = workbench.history.goBack();
    await Promise.resolve();

    expect(back?.viewId).toBe(dashboardViews.sessions.id);
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.session);
    expect(workbench.layout.getLayout().activeResourceUri).toBeUndefined();
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.session,
    ]);
    expect(workbench.layout.getLayout().regions.main.widgets[0]?.viewId).toBe(dashboardViews.sessions.id);

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
    workbench.registerModule(createSessionsModule());

    await workbench.commands.executeCommand(dashboardCommandIds.openSessions);

    expect(workbench.layout.getLayout().regions.main.widgets[0]?.viewId).toBe(dashboardViews.sessions.id);
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
