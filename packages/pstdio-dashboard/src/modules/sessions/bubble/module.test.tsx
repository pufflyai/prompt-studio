import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createSessionBubbleModule } from "./module";

const projectPage = { extensionId: "pstdio.test", kind: "page" as const, id: "project" };
const activateProjectPage = async (workbench: ReturnType<typeof createWorkbench>) => {
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "project", title: "Project", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "test.project",
    ref: projectPage,
    title: "Project",
    path: "",
    modeId: "project",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "project",
      },
      cardinality: "one",
    },
    slots: [],
  });
  workbench.pageLocations.setProject("project-1");
  await workbench.navigation.openTarget({ kind: "page", page: projectPage });
};
const sessionPlacements = (workbench: ReturnType<typeof createWorkbench>) =>
  workbench.layout
    .getLayout()
    .regions.side.widgets.filter((widget) => widget.viewId === dashboardWidgetIds.sessionBubble);
describe("createSessionBubbleModule", () => {
  for (const retention of ["preview", "persistent"] as const) {
    test(`replaces the originating ${retention} draft through its recent-session action`, async () => {
      const workbench = createWorkbench();
      workbench.registerModule(createSessionBubbleModule());
      await activateProjectPage(workbench);
      workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
      getWriter("sessions")!.upsert({
        id: "menu-session",
        project_id: "project-1",
        title: "Selected session",
        status: "completed",
      });
      await workbench.commands.executeCommand(
        dashboardCommandIds.createSession,
        undefined,
        retention === "persistent" ? { source: "panel-add" } : undefined,
      );
      const origin = sessionPlacements(workbench)[0]!;
      await workbench.commands.executeCommand(dashboardCommandIds.createSession, undefined, { source: "panel-add" });
      const sibling = sessionPlacements(workbench)[1]!;
      const snapshot = origin.tab!.getSnapshot!(
        workbench.layout.listPanelInstances("side").find((panel) => panel.instanceId === origin.widgetId)!,
      );
      const action = snapshot
        .menu!.find((group) => group.id === "recent")!
        .rows.find((row) => row.id === "menu-session")!.action!;
      if (action.kind !== "command") throw new Error("Expected a session command");
      await workbench.commands.executeCommand(action.commandId, action.args);
      const after = sessionPlacements(workbench);
      expect(after).toHaveLength(2);
      expect(after[0]).toMatchObject({
        placementIdentity: origin.placementIdentity,
        resource: { id: "menu-session", type: "session" },
        tabRetention: retention,
      });
      expect(after[1]).toEqual(sibling);
      expect(workbench.layout.getLayout().regions.side.activeWidgetId).toBe(after[0]!.widgetId);
      getWriter("sessions")!.remove("menu-session");
    });
  }
  for (const retention of ["preview", "persistent"] as const) {
    test(`replaces the originating ${retention} session through its New session action`, async () => {
      const workbench = createWorkbench();
      workbench.registerModule(createSessionBubbleModule());
      await activateProjectPage(workbench);
      const resource = createDashboardResource("session", "session-origin", "Origin", "MessageCircle", "project-1");
      await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
        resource,
        tabRetention: retention,
      });
      const origin = sessionPlacements(workbench)[0]!;
      await workbench.commands.executeCommand(dashboardCommandIds.createSession, undefined, { source: "panel-add" });
      const sibling = sessionPlacements(workbench)[1]!;
      const snapshot = origin.tab!.getSnapshot!(
        workbench.layout.listPanelInstances("side").find((panel) => panel.instanceId === origin.widgetId)!,
      );
      const action = snapshot.menu!.find((group) => group.id === "create")!.rows[0]!.action!;
      if (action.kind !== "command") throw new Error("Expected a session command");
      await workbench.commands.executeCommand(action.commandId, action.args);
      const after = sessionPlacements(workbench);
      expect(after).toHaveLength(2);
      expect(after[0]).toMatchObject({
        placementIdentity: origin.placementIdentity,
        resource: { type: "session-draft" },
        tabRetention: retention,
      });
      expect(after[1]).toEqual(sibling);
      expect(workbench.layout.getLayout().regions.side.activeWidgetId).toBe(after[0]!.widgetId);
    });
  }
  test("declares the project Session Panel without opening it", () => {
    const workbench = createWorkbench();
    workbench.resources.registerKind({ kind: "workspace", label: "Workspace" });
    workbench.resources.registerKind({ kind: "recipe", label: "Recipe" });
    workbench.registerModule(createSessionBubbleModule());
    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([]);
    expect(workbench.modePlacements.listPlacements("project")).toEqual([
      expect.objectContaining({
        ref: { extensionId: "pstdio", kind: "placement", id: "project-session" },
        item: {
          kind: "binding",
          binding: expect.objectContaining({
            kinds: [
              { kind: "resource-kind", id: "session" },
              { kind: "resource-kind", id: "session-draft" },
            ],
            cardinality: "many",
          }),
        },
        region: "side",
      }),
    ]);
    const contribution = workbench.modePlacements.listPlacements("project")[0];
    expect(contribution).toMatchObject({
      region: "side",
      item: {
        kind: "binding",
        binding: expect.objectContaining({
          add: {
            kind: "command",
            target: { command: { kind: "command", extensionId: "pstdio", id: dashboardCommandIds.createSession } },
          },
        }),
      },
    });
    expect(contribution?.tab?.getSnapshot).toBeFunction();
    expect(contribution?.tab?.subscribe).toBeFunction();
  });
  test("opens a workspace-linked draft through the explicit project panel", async () => {
    const workbench = createWorkbench({ initialSidePanelMode: "closed" });
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });
    workbench.registerModule(createSessionBubbleModule());
    await activateProjectPage(workbench);
    await workbench.commands.executeCommand(dashboardCommandIds.createSession, { workspace });
    expect(sessionPlacements(workbench)).toEqual([
      expect.objectContaining({
        resource: expect.objectContaining({
          type: "session-draft",
          metadata: expect.objectContaining({ workspaceId: "workspace-1", workspaceShorthand: "PS-307_A1" }),
        }),
        tabRetention: "preview",
      }),
    ]);
    expect(workbench.sidePanel.getMode()).toBe("attached");
  });
  test("replaces the preview but retains pinned session tabs", async () => {
    const workbench = createWorkbench();
    const first = createDashboardResource("session", "session-1", "First", "MessageCircle", "project-1");
    const second = createDashboardResource("session", "session-2", "Second", "MessageCircle", "project-1");
    workbench.registerModule(createSessionBubbleModule());
    await activateProjectPage(workbench);
    await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, { resource: first });
    await workbench.commands.executeCommand(dashboardCommandIds.createSession, undefined, { source: "panel-add" });
    await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, { resource: second });
    const placements = sessionPlacements(workbench);
    expect(placements).toHaveLength(2);
    expect(placements).toContainEqual(
      expect.objectContaining({
        resource: expect.objectContaining({ type: "session-draft" }),
        tabRetention: "persistent",
      }),
    );
    expect(placements).toContainEqual(
      expect.objectContaining({ resource: expect.objectContaining({ id: "session-2" }), tabRetention: "preview" }),
    );
    expect(placements.some((placement) => placement.resource?.id === "session-1")).toBe(false);
  });
  test("uses resource type and id as the canonical session identity", async () => {
    const workbench = createWorkbench();
    const dashboardSession = createDashboardResource("session", "session-1", "Session A", "MessageCircle", "project-1");
    const extensionSession = {
      type: "session",
      id: "session-1",
      label: "Session A",
    };
    workbench.registerModule(createSessionBubbleModule());
    await activateProjectPage(workbench);
    await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: dashboardSession,
      tabRetention: "persistent",
    });
    await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, { resource: extensionSession });
    expect(sessionPlacements(workbench)).toEqual([
      expect.objectContaining({ resource: expect.objectContaining({ id: "session-1" }), tabRetention: "persistent" }),
    ]);
  });
});
