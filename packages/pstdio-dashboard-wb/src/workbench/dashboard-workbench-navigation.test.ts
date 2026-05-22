import { beforeEach, describe, expect, test } from "bun:test";
import { createWorkbenchCore, type TreeNode, type WorkbenchCore } from "pstdio-workbench/core";
import { createDashboardExampleModules } from "./dashboard-workbench";
import type { DashboardSession, DashboardWorkspace } from "./data/dashboard-data";
import { createSessionRows } from "./modules/sessions/collections/session-data-renderer";
import { dashboardSettingsNavigationTreeViewId } from "./modules/settings/settings-nav";
import { dashboardResources } from "./shared/resources";
import { dashboardWidgetIds } from "./shared/widget-ids";
import { seedDashboardWorkbenchRows } from "./test-utils/dashboard-data-fixture";

let dashboardWorkspaces: DashboardWorkspace[] = [];
let dashboardSessions: DashboardSession[] = [];

const createDashboardWorkbench = () => {
  const workbench = createWorkbenchCore();
  for (const module of createDashboardExampleModules()) workbench.registerModule(module);
  return workbench;
};

// After the unification, trees are placed via widgets. The "active" tree is the
// active widget in the left area whose rendererId matches a registered tree
// renderer.
const resolveLeftTreePlacementIds = (workbench: WorkbenchCore) => {
  const leftWidgets = workbench.layout.getLayout().areas.left.widgets;
  return leftWidgets
    .map((placement) => workbench.layout.getWidget(placement.contributionId))
    .filter((widget): widget is NonNullable<typeof widget> => Boolean(widget))
    .filter((widget) => workbench.renderers.getTreeRenderer(widget.rendererId))
    .map((widget) => widget.id);
};

const resolveAreaPlacementIds = (
  workbench: WorkbenchCore,
  area: keyof ReturnType<WorkbenchCore["layout"]["getLayout"]>["areas"],
) => workbench.layout.getLayout().areas[area].widgets.map((placement) => placement.contributionId);

const findTreeNode = (nodes: TreeNode[], nodeId: string): TreeNode | undefined => {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findTreeNode(node.children ?? [], nodeId);
    if (child) return child;
  }

  return undefined;
};

beforeEach(() => {
  const rows = seedDashboardWorkbenchRows();
  dashboardWorkspaces = rows.dashboardWorkspaces;
  dashboardSessions = rows.dashboardSessions;
});

describe("dashboard workbench navigation", () => {
  test("keeps the session bubble available in workspace and settings modes", async () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.sessionPanel.getMode()).toBe("bubble");
    expect(workbench.layout.getWidget(dashboardWidgetIds.sessionBubble)).toBeDefined();
    expect(workbench.layout.getWidget(dashboardWidgetIds.sessionBubbleHeader)).toBeDefined();
    expect(resolveAreaPlacementIds(workbench, "floating")).toEqual([dashboardWidgetIds.sessionBubble]);
    expect(resolveAreaPlacementIds(workbench, "floating-header")).toEqual([dashboardWidgetIds.sessionBubbleHeader]);

    await workbench.resources.openResource(dashboardResources.settings, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("settings");
    expect(workbench.sessionPanel.getMode()).toBe("bubble");
    expect(resolveAreaPlacementIds(workbench, "floating")).toEqual([dashboardWidgetIds.sessionBubble]);
    expect(resolveAreaPlacementIds(workbench, "floating-header")).toEqual([dashboardWidgetIds.sessionBubbleHeader]);

    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(resolveAreaPlacementIds(workbench, "floating")).toEqual([dashboardWidgetIds.sessionBubble]);
    expect(resolveAreaPlacementIds(workbench, "floating-header")).toEqual([dashboardWidgetIds.sessionBubbleHeader]);
  });

  test("switches the sidebar between workspace, sessions, and settings modes", async () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.workspaceSidebar]);

    await workbench.resources.openResource(dashboardResources.sessions, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("sessions");
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.sessionsSidebar]);

    await workbench.resources.openResource(dashboardResources.settings, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("settings");
    expect(resolveLeftTreePlacementIds(workbench)).toContain(dashboardSettingsNavigationTreeViewId);
    await expect(workbench.renderers.getBody(dashboardSettingsNavigationTreeViewId)).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "settings-back" })]),
    );

    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.workspaceSidebar]);
  });

  test("registers dashboard resources without the legacy issue tracker mock", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.resources.getKind("ticket")).toBeUndefined();
    expect(workbench.resources.listProviders().map((provider) => provider.kind)).not.toContain("ticket");
    expect(workbench.resources.listResources("").map((entry) => entry.resource.kind)).not.toContain("ticket");
  });

  test("opens workspace resources with a workspace sidebar and widget tabs", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces[0];

    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });

    const workspaceRenderer = workbench.renderers.getDataRenderer(dashboardWidgetIds.workspaces);
    expect(workspaceRenderer).toBeDefined();
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.workspaces);

    await workbench.resources.openResource(workspace.resource, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(resolveAreaPlacementIds(workbench, "left")).toEqual([dashboardWidgetIds.workspaceSidebar]);
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.workspaceSidebar]);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.workspaceSidebar).selectedNodeId).toBe(
      workspace.resource.uri,
    );
    expect(resolveAreaPlacementIds(workbench, "main")).toEqual([
      dashboardWidgetIds.workspaceChanges,
      dashboardWidgetIds.workspaceChecks,
    ]);
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.workspaceChanges);

    await expect(workbench.renderers.getFooter(dashboardWidgetIds.workspaceSidebar)).resolves.toEqual([
      expect.objectContaining({ id: "help", label: "Help", menuPath: ["dashboardWorkbench", "help"] }),
      expect.objectContaining({ id: dashboardResources.sessions.uri, resource: dashboardResources.sessions }),
      expect.objectContaining({ id: dashboardResources.settings.uri, resource: dashboardResources.settings }),
    ]);
  });

  test("selects the workspaces sidebar entry when the workspaces board opens", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces[0];

    await workbench.resources.openResource(workspace.resource, { replaceActive: true });
    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });

    expect(workbench.renderers.getTreeState(dashboardWidgetIds.workspaceSidebar).selectedNodeId).toBe(
      dashboardResources.workspaces.uri,
    );
  });

  test("returns to the workspaces board without leaving detail widget tabs behind", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces[0];

    await workbench.resources.openResource(workspace.resource, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(resolveAreaPlacementIds(workbench, "main")).toEqual([
      dashboardWidgetIds.workspaceChanges,
      dashboardWidgetIds.workspaceChecks,
    ]);

    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(resolveAreaPlacementIds(workbench, "main")).toEqual([dashboardWidgetIds.workspaces]);
  });

  test("shows a single workspaces entry in project mode and the open workspace's sessions in workspace mode", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces[0];

    const projectBody = await workbench.renderers.getBody(dashboardWidgetIds.workspaceSidebar);
    const workspacesEntry = findTreeNode(
      projectBody.flatMap((section) => section.nodes),
      dashboardResources.workspaces.uri,
    );
    expect(workspacesEntry?.resource).toEqual(dashboardResources.workspaces);
    expect(projectBody.some((section) => section.id === "sessions")).toBe(false);

    await workbench.resources.openResource(workspace.resource, { replaceActive: true });

    const workspaceBody = await workbench.renderers.getBody(dashboardWidgetIds.workspaceSidebar);
    const sessionsSection = workspaceBody.find((section) => section.id === "sessions");
    expect(sessionsSection?.nodes.map((node) => node.id)).toEqual(
      workspace.sessions.map((session) => session.resource.uri),
    );
  });

  test("opens workspace sidebar session entries in the floating session panel", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces[0];
    const session = workspace.sessions[0];

    await workbench.resources.openResource(workspace.resource, { replaceActive: true });

    const workspaceSidebarBody = await workbench.renderers.getBody(dashboardWidgetIds.workspaceSidebar);
    const workspaceSessionNode = findTreeNode(
      workspaceSidebarBody.flatMap((section) => section.nodes),
      session.resource.uri,
    );

    expect(workspaceSessionNode?.resource).toBeUndefined();
    expect(workspaceSessionNode?.target).toEqual({
      kind: "command",
      commandId: "dashboard.openFloatingSession",
      args: { resource: session.resource },
    });

    await workbench.navigation.openTarget(workspaceSessionNode?.target ?? { kind: "command", commandId: "missing" });

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.workspaceSidebar]);
    expect(resolveAreaPlacementIds(workbench, "main")).toEqual([
      dashboardWidgetIds.workspaceChanges,
      dashboardWidgetIds.workspaceChecks,
    ]);
    expect(resolveAreaPlacementIds(workbench, "floating")).toEqual([dashboardWidgetIds.sessionBubble]);
    expect(workbench.layout.getLayout().areas.floating.widgets[0]?.resourceUri).toBe(session.resource.uri);
  });

  test("loads the workspace's first session into the floating bubble", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces[0];

    await workbench.resources.openResource(workspace.resource, { replaceActive: true });

    expect(workbench.layout.getLayout().areas.floating.widgets[0]?.resourceUri).toBe(
      workspace.sessions[0].resource.uri,
    );
  });

  test("opens session resources from the sessions sidebar mode", async () => {
    const workbench = createDashboardWorkbench();
    const session = dashboardSessions[0];

    await workbench.resources.openResource(dashboardResources.sessions, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("sessions");
    expect(resolveAreaPlacementIds(workbench, "floating")).toEqual([]);
    expect(resolveAreaPlacementIds(workbench, "floating-header")).toEqual([]);
    expect(resolveAreaPlacementIds(workbench, "left")).toEqual([dashboardWidgetIds.sessionsSidebar]);
    const sessionsSidebarBody = await workbench.renderers.getBody(dashboardWidgetIds.sessionsSidebar);
    expect(sessionsSidebarBody).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "sessions",
          nodes: expect.arrayContaining([expect.objectContaining({ id: session.resource.uri })]),
        }),
      ]),
    );
    const sessionSidebarNode = findTreeNode(
      sessionsSidebarBody.flatMap((section) => section.nodes),
      session.resource.uri,
    );
    expect(sessionSidebarNode?.description).toBeUndefined();

    await workbench.resources.openResource(session.resource, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("sessions");
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.sessionsSidebar]);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.sessionsSidebar).selectedNodeId).toBe(
      session.resource.uri,
    );
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.session);

    await expect(workbench.renderers.getFooter(dashboardWidgetIds.sessionsSidebar)).resolves.toEqual([]);
  });

  test("lists every session as a navigable data renderer board", async () => {
    const workbench = createDashboardWorkbench();
    const session = dashboardSessions[0];

    await workbench.resources.openResource(dashboardResources.sessions, { replaceActive: true });

    const sessionsRenderer = workbench.renderers.getDataRenderer(dashboardWidgetIds.sessions);
    expect(sessionsRenderer?.resourceKind).toBe("session");
    expect(sessionsRenderer?.onTicketClick).toBeDefined();
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.sessions);

    expect(createSessionRows().map((row) => row.id)).toEqual(dashboardSessions.map((entry) => entry.resource.uri));

    await workbench.resources.openResource(session.resource, { replaceActive: true });

    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.session);
  });
});

describe("dashboard workbench session panel", () => {
  test("keeps the session panel attached when switching workspace sessions", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces[0];
    const session = workspace.sessions[1];

    await workbench.resources.openResource(workspace.resource, { replaceActive: true });
    workbench.sessionPanel.setMode("attached");

    const workspaceSidebarBody = await workbench.renderers.getBody(dashboardWidgetIds.workspaceSidebar);
    const workspaceSessionNode = findTreeNode(
      workspaceSidebarBody.flatMap((section) => section.nodes),
      session.resource.uri,
    );

    await workbench.navigation.openTarget(workspaceSessionNode?.target ?? { kind: "command", commandId: "missing" });

    expect(workbench.sessionPanel.getMode()).toBe("attached");
    expect(workbench.layout.getLayout().areas.floating.widgets[0]?.resourceUri).toBe(session.resource.uri);
  });
});
