import { describe, expect, test } from "bun:test";
import { resourceKey, workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey, selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, createDashboardSessionResource, dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage, openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionsModule } from "./module";

describe("createSessionsModule", () => {
  test("registers the session resource kind", () => {
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    workbench.registerModule(createSessionsModule());
    expect(workbench.resources.getKind("session")).toMatchObject({
      label: "Session",
      icon: "MessageCircle",
    });
    expect(workbench.views.getView(dashboardWidgetIds.session)).toBeDefined();
    expect(workbench.pages.getPage(dashboardViews.sessions.id)).toMatchObject({
      ref: workbenchPages.sessions,
      modeId: "project",
      path: "sessions",
    });
  });
  test("renders aggregate sessions in the Sessions level and scoped sessions for a workspace resource", async () => {
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    const workspace = createDashboardResource("workspace", "workspace-1", "Workspace one", "GitBranch", "project-1");
    const ticket = createDashboardResource("ticket", "ticket-1", "PS-1", "FileText", "project-1");
    workbench.registerModule(createSessionsModule());
    const sections = (owner: "sessions" | "project", resource?: typeof workspace) =>
      workbench.navigationTrees.getSections(
        { kind: owner === "sessions" ? "page" : "mode", id: owner, extensionId: "pstdio" },
        "content",
        resource ? { resource } : {},
      );
    const nodeIdsForContext = async (owner: "project", resource?: typeof workspace) =>
      (await sections(owner, resource)).flatMap((section) => section.nodes).map((node) => node.id);
    expect((await sections("sessions")).map((section) => section.id)).toEqual(["session-list"]);
    expect(await nodeIdsForContext("project", workspace)).toContain("workspace-sessions");
    expect(await nodeIdsForContext("project", ticket)).not.toContain("workspace-sessions");
    expect(await nodeIdsForContext("project")).not.toContain("workspace-sessions");
  });
  test("adds sessions navigation as a sidenav section", async () => {
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    workbench.registerModule(createSessionsModule());
    const sessionsNode = (
      await workbench.navigationTrees.getSections({ kind: "mode", id: "project", extensionId: "pstdio" })
    )
      .flatMap((section) => section.nodes)
      .find((node) => node.id === dashboardViews.sessions.id);
    expect(sessionsNode).toMatchObject({
      target: { kind: "command", commandId: dashboardCommandIds.openSessions },
    });
  });
  test("keeps the sessions root in the breadcrumb when a session opens", async () => {
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    const session = createDashboardSessionResource("session-1", "My session", "project-1", {
      status: "completed",
    });
    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
    workbench.registerModule(createSessionsModule());
    openSessionsPage(workbench, session);
    expect(workbench.pages.store.getState().activePageId).toBe(workbenchPages.session.id);
    expect(workbench.pages.getContent()?.placementIdentity).toMatchObject({
      kind: "page",
      pageId: workbenchPages.session.id,
    });
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Sessions", "My session"]);
  });
  test("replaces the Main session when another session is selected", () => {
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    const first = createDashboardSessionResource("session-1", "First session", "project-1");
    const second = createDashboardSessionResource("session-2", "Second session", "project-1");
    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
    workbench.registerModule(createSessionsModule());
    openSessionsPage(workbench, first);
    openSessionsPage(workbench, second);
    const mainTabs = workbench.layout.getLayout().regions.main.widgets;
    expect(mainTabs).toHaveLength(0);
    expect(workbench.pages.getContent()?.resourceKey).toBe(resourceKey(second));
  });
  test("updates the breadcrumb when starting a new session from sessions", async () => {
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    const session = createDashboardSessionResource("session-1", "My session", "project-1", {
      status: "completed",
    });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.registerModule(createSessionsModule());
    openSessionsPage(workbench, session);
    await workbench.commands.executeCommand(dashboardCommandIds.createSession);
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Sessions", "New session"]);
    expect(workbench.pages.store.getState().location?.page).toEqual(workbenchPages.newSession);
    expect(workbench.layout.listPanelInstances("main")).toHaveLength(0);
    expect(workbench.pages.getContent()?.resource?.type).toBe("session-draft");
  });
  test("navigates back from a session to the sessions root", async () => {
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    const session = createDashboardSessionResource("session-2", "Second session", "project-1", {
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
    expect(workbench.pages.store.getState().location?.page).toEqual(workbenchPages.sessionComposer);
    expect(workbench.pages.getContent()?.resource).toBeUndefined();
    expect(workbench.layout.getLayout().activeResourceKey).toBeUndefined();
    expect(workbench.layout.getLayout().regions.main.widgets).toHaveLength(0);
    expect(workbench.breadcrumbs.getItems()?.at(-1)?.title).toBe("New session");
    workbench.pageLocations.goForward();
    await Promise.resolve();
    expect(workbench.pages.store.getState().location?.resource).toMatchObject({ type: "session", id: "session-2" });
    expect(workbench.getPrimaryResource()?.id).toBe(session.id);
    expect(workbench.pages.getContent()?.viewId).toBe(dashboardWidgetIds.session);
  });
  test("opens the project-owned sessions aggregate from global navigation", async () => {
    seedContractSessions();
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.registerModule(createSessionsModule());
    workbench.pageLocations.setProject("project-1");
    await workbench.commands.executeCommand(dashboardCommandIds.openSessions);
    expect(workbench.layout.getLayout().regions.main.widgets).toHaveLength(0);
    expect(workbench.breadcrumbs.getItems()?.at(-1)?.title).toBe("New session");
    expect(workbench.getPrimaryResource()).toBeUndefined();
  });
  test("opens the new-session landing from global navigation after viewing a session", async () => {
    seedContractSessions();
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    const session = createDashboardSessionResource("session-2", "Second session", "project-1", {
      status: "completed",
    });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.registerModule(createSessionsModule());
    openSessionsPage(workbench, session);
    await workbench.commands.executeCommand(dashboardCommandIds.openSessions);
    expect(workbench.getPrimaryResource()).toBeUndefined();
    expect(workbench.pages.getContent()?.viewId).toBe(dashboardWidgetIds.session);
    expect(workbench.pages.store.getState().location?.page).toEqual(workbenchPages.sessionComposer);
  });
  test("opens command palette session resources in Main", async () => {
    seedContractSessions();
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    workbench.registerModule(createSessionsModule());
    workbench.sidePanel.setMode("closed");
    openWorkspacesPage(workbench);
    const sessionEntry = workbench.resources
      .listResources("")
      .find(
        (entry) =>
          resourceKey(entry.resource) ===
          resourceKey({ type: "session", id: "session-1", extensionId: "pstdio", projectId: "project-1" }),
      );
    if (sessionEntry) await sessionEntry.activate?.(sessionEntry.resource);
    expect(workbench.pages.getContent()?.resource?.id).toBe("session-1");
    expect(workbench.pages.store.getState().location?.page).toEqual(workbenchPages.session);
    expect(workbench.layout.listPanelInstances("side")).toHaveLength(0);
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

test("global Sessions navigation establishes the selected project before opening its landing", async () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionsModule());
  workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
  workbench.pageLocations.clearProject();
  await workbench.commands.executeCommand(dashboardCommandIds.openSessions);
  expect(workbench.pages.store.getState().projectId).toBe("project-1");
  expect(workbench.pages.store.getState().location?.page).toEqual(workbenchPages.sessionComposer);
});
