import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
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
