import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage, openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionsModule } from "../module";
import { createSessionBubbleModule } from "./module";
import { openDashboardSidePanel } from "./open-side-panel";

test("opens an empty chat panel with a workspace session draft and reuses it on reopen", async () => {
  const workbench = createWorkbench({ initialSidePanelMode: "closed" });
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionBubbleModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  const workspace = createDashboardResource("workspace", "workspace-1", "Workspace", "GitBranch", "project-1");
  openWorkspacesPage(workbench, workspace);
  const location = workbench.pages.store.getState().location;
  expect(workbench.layout.listPanelInstances("side")).toHaveLength(0);

  await openDashboardSidePanel(workbench);
  const panels = workbench.layout.listPanelInstances("side");
  expect(panels).toHaveLength(1);
  expect(panels[0]).toMatchObject({
    viewId: dashboardWidgetIds.sessionBubble,
    resource: { type: "session-draft", metadata: { workspaceId: "workspace-1" } },
  });
  expect(workbench.sidePanel.getMode()).toBe("floating");
  expect(workbench.pages.store.getState().location).toEqual(location);

  workbench.sidePanel.setMode("closed");
  await openDashboardSidePanel(workbench);
  expect(workbench.layout.listPanelInstances("side")).toEqual(panels);
  expect(workbench.sidePanel.getMode()).toBe("floating");
  expect(workbench.pages.store.getState().location).toEqual(location);
});

test("opens the session draft in the Side Panel while a session page is open", async () => {
  const workbench = createWorkbench({ initialSidePanelMode: "closed" });
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionsModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  openSessionsPage(workbench, createDashboardResource("session", "session-1", "Session", "MessageCircle", "project-1"));
  const location = workbench.pages.store.getState().location;

  await openDashboardSidePanel(workbench);
  expect(workbench.layout.listPanelInstances("side")).toEqual([
    expect.objectContaining({
      viewId: dashboardWidgetIds.sessionBubble,
      resource: expect.objectContaining({ type: "session-draft" }),
    }),
  ]);
  expect(workbench.pages.store.getState().location).toEqual(location);
});

test("opens a session beside an extension page and keeps each mode's sessions separate", async () => {
  const workbench = createWorkbench({ initialSidePanelMode: "closed" });
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionBubbleModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  workbench.pageLocations.setProject("project-1");
  workbench.modes.registerMode({ id: "notes", panels: ["main", "side"], activate() {} });
  workbench.views.registerView({ id: "notes", title: "Notes", body: { kind: "react", render: () => null } });
  const page = { kind: "page", extensionId: "notes", id: "notes" } as const;
  workbench.pages.registerPage({
    id: "notes",
    ref: page,
    modeId: "notes",
    path: "notes",
    main: { kind: "view", view: { kind: "view", id: "notes" }, cardinality: "one" },
    slots: [],
  });
  await workbench.navigation.openTarget({ kind: "page", page });
  const location = workbench.pages.store.getState().location;
  expect(workbench.modes.getActiveModeId()).toBe("notes");
  await openDashboardSidePanel(workbench);
  const notesSession = workbench.layout.listPanelInstances("side")[0];
  expect(notesSession).toMatchObject({ viewId: dashboardWidgetIds.sessionBubble, resource: { type: "session-draft" } });
  expect(workbench.pages.store.getState().location).toEqual(location);
  expect(workbench.sidePanel.getMode()).toBe("floating");
  openWorkspacesPage(workbench);
  expect(workbench.layout.listPanelInstances("side")).toHaveLength(0);
  await openDashboardSidePanel(workbench);
  expect(workbench.layout.listPanelInstances("side")[0].resource?.id).not.toBe(notesSession.resource?.id);
  await workbench.navigation.openTarget({ kind: "page", page });
  expect(workbench.layout.listPanelInstances("side")[0].resource?.id).toBe(notesSession.resource?.id);
});

test("opens a session tab alongside an extension reader", async () => {
  const workbench = createWorkbench({ initialSidePanelMode: "attached" });
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionBubbleModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  openWorkspacesPage(workbench);
  workbench.views.registerView({ id: "reader", title: "Message", body: { kind: "react", render: () => null } });
  workbench.shellPlacements.registerPlacement({
    id: "reader",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "reader" }, presence: "open" },
  });
  const reader = workbench.layout.listPanelInstances("side")[0];
  await openDashboardSidePanel(workbench);
  expect(workbench.layout.listPanelInstances("side")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ viewId: "reader", instanceId: reader.instanceId }),
      expect.objectContaining({ viewId: dashboardWidgetIds.sessionBubble }),
    ]),
  );
  const session = workbench.layout.getActivePanel("side");
  expect(session?.viewId).toBe(dashboardWidgetIds.sessionBubble);
  await openDashboardSidePanel(workbench);
  expect(workbench.layout.listPanelInstances("side")).toHaveLength(2);
});

test("reopens the active session when several session tabs exist", async () => {
  const workbench = createWorkbench({ initialSidePanelMode: "closed" });
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionBubbleModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  openWorkspacesPage(workbench);
  for (let index = 0; index < 2; index++) {
    await workbench.commands.executeCommand(dashboardCommandIds.createSession, undefined, { source: "panel-add" });
  }
  const session = workbench.layout.getActivePanel("side");
  workbench.sidePanel.setMode("closed");
  await openDashboardSidePanel(workbench);
  expect(workbench.layout.getActivePanel("side")?.instanceId).toBe(session?.instanceId);
});

test("a Side Panel requested while the project loads opens its session once the project mode starts", async () => {
  const workbench = createWorkbench({ initialSidePanelMode: "closed" });
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionBubbleModule());
  // A saved project waits for its synced rows before the project mode starts.
  expect(workbench.modes.getActiveModeId()).toBeUndefined();

  const opened = openDashboardSidePanel(workbench);
  expect(workbench.layout.listPanelInstances("side")).toHaveLength(0);

  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  openWorkspacesPage(workbench);
  await opened;
  expect(workbench.sidePanel.getMode()).toBe("floating");
  expect(workbench.layout.listPanelInstances("side")).toEqual([
    expect.objectContaining({ viewId: dashboardWidgetIds.sessionBubble }),
  ]);
});
