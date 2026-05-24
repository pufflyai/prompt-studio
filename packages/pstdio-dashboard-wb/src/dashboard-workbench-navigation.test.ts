import { beforeEach, describe, expect, test } from "bun:test";
import type { DashboardExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore, type TreeNode, type WorkbenchCore } from "pstdio-workbench/core";
import { getWriter } from "@/lib/sync/collections";
import { createDashboardExampleModules } from "./dashboard-workbench";
import { createDashboardProjects } from "./modules/projects/data/project-data";
import type { DashboardSession } from "./modules/sessions/data/dashboard-sessions";
import { dashboardSettingsNavigationTreeViewId } from "./modules/settings/settings-nav";
import { createWorkspaceRows } from "./modules/workspaces/collections/workspace-data-renderer";
import type { DashboardWorkspace } from "./modules/workspaces/data/dashboard-workspaces";
import {
  clearCachedDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "./shared/extensions/workbench-extension-contributions";
import { dashboardSelectedProjectIdContextKey, dashboardSelectedProjectNameContextKey } from "./shared/project-context";
import { dashboardResources } from "./shared/resources";
import { dashboardWidgetIds } from "./shared/widget-ids";
import { seedDashboardWorkbenchRows } from "./test-utils/dashboard-data-fixture";

let dashboardWorkspaces: DashboardWorkspace[] = [];
let dashboardSessions: DashboardSession[] = [];

const extensionMetadata = {
  extensions: [{ id: "pstdio.extension-lab", name: "extension-lab", displayName: "Extension Lab", sourcePath: "" }],
  commands: [],
  diagnostics: [],
  menuContributions: [],
  navigation: [
    {
      id: "extension-lab.labPage",
      extensionId: "pstdio.extension-lab",
      slotId: "project.sidebarNav",
      group: "Lab",
      label: "Lab",
      route: "lab",
      icon: "flask-conical",
    },
  ],
  routes: [
    {
      id: "extension-lab.labPage",
      extensionId: "pstdio.extension-lab",
      path: "lab",
      label: "Lab",
      webview: {
        entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/extension-lab/webviews/extension-lab.labPage/module.js",
      },
    },
  ],
  settingsPanels: [],
  views: [],
} satisfies DashboardExtensionMetadata;

const createDashboardWorkbench = (selectedProjectId: string | undefined = "project-1") => {
  const workbench = createWorkbenchCore();
  for (const module of createDashboardExampleModules()) workbench.registerModule(module);

  const project = selectedProjectId ? createDashboardProjects().find((entry) => entry.id === selectedProjectId) : null;
  if (project) void workbench.resources.openResource(project.resource, { replaceActive: true });

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

    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.workspaceSidebar]);
  });
});

describe("dashboard workbench resource navigation", () => {
  test("opens projects through the workbench resource API and filters dashboard data", async () => {
    const workbench = createDashboardWorkbench();
    const project = createDashboardProjects().find((entry) => entry.id === "project-2");

    expect(project).toBeDefined();

    await workbench.resources.openResource(project!.resource, { replaceActive: true });

    expect(workbench.context.get(dashboardSelectedProjectIdContextKey)).toBe("project-2");
    expect(workbench.context.get(dashboardSelectedProjectNameContextKey)).toBe("Datazine");
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().activeResourceUri).toBe(dashboardResources.workspaces.uri);
    expect(createWorkspaceRows("project-2").map((row) => row.id)).toEqual([
      "dashboard-workbench://workspace/workspace-3",
    ]);
    expect(workbench.resources.listResources("").filter((entry) => entry.resource.kind === "workspace")).toEqual([
      expect.objectContaining({ resource: expect.objectContaining({ id: "workspace-3" }) }),
    ]);
  });

  test("switches projects while a workspace detail is open", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces.find((entry) => entry.id === "workspace-1");
    const project = createDashboardProjects().find((entry) => entry.id === "project-2");

    expect(workspace).toBeDefined();
    expect(project).toBeDefined();

    await workbench.resources.openResource(workspace!.resource, { replaceActive: true });
    await workbench.resources.openResource(project!.resource, { replaceActive: true });

    expect(workbench.context.get(dashboardSelectedProjectIdContextKey)).toBe("project-2");
    expect(workbench.context.get(dashboardSelectedProjectNameContextKey)).toBe("Datazine");
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().activeResourceUri).toBe(dashboardResources.workspaces.uri);
    expect(createWorkspaceRows("project-2").map((row) => row.id)).toEqual([
      "dashboard-workbench://workspace/workspace-3",
    ]);
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
    const expectedSessionIds = dashboardSessions
      .filter((session) => session.workspaceId === workspace.id)
      .map((session) => session.resource.uri);
    expect(sessionsSection?.nodes.map((node) => node.id)).toEqual(expectedSessionIds);
  });

  test("keeps project extension navigation visible in workspace mode", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces[0];

    setCachedDashboardExtensionMetadata("project-1", extensionMetadata);

    try {
      workbench.renderers.refresh(dashboardWidgetIds.workspaceSidebar);

      const projectBody = await workbench.renderers.getBody(dashboardWidgetIds.workspaceSidebar);
      expect(projectBody.find((section) => section.label === "Lab")?.nodes.map((node) => node.label)).toEqual(["Lab"]);

      await workbench.resources.openResource(workspace.resource, { replaceActive: true });
      setCachedDashboardExtensionMetadata("project-1", extensionMetadata);

      const workspaceBody = await workbench.renderers.getBody(dashboardWidgetIds.workspaceSidebar);
      expect(workspaceBody.find((section) => section.label === "Lab")?.nodes.map((node) => node.label)).toEqual([
        "Lab",
      ]);
      expect(workspaceBody.find((section) => section.id === "sessions")?.nodes).toHaveLength(workspace.sessions.length);
    } finally {
      clearCachedDashboardExtensionMetadata("project-1");
    }
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
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.workspaceSidebar).selectedNodeId).toBe(
      session.resource.uri,
    );

    const refreshedWorkspaceSidebarBody = await workbench.renderers.getBody(dashboardWidgetIds.workspaceSidebar);
    expect(refreshedWorkspaceSidebarBody.find((section) => section.id === "sessions")?.nodes).toHaveLength(
      workspace.sessions.length,
    );
  });

  test("loads the workspace's first session into the floating bubble", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces[0];

    await workbench.resources.openResource(workspace.resource, { replaceActive: true });

    expect(workbench.layout.getLayout().areas.floating.widgets[0]?.resourceUri).toBe(
      workspace.sessions[0].resource.uri,
    );
  });

  test("restores the selected sessions-mode session into the floating bubble when leaving sessions mode", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces[0];
    const session = workspace.sessions[1];

    await workbench.resources.openResource(dashboardResources.sessions, { replaceActive: true });
    await workbench.resources.openResource(session.resource, { replaceActive: true });

    expect(workbench.layout.getLayout().areas.main.widgets[0]?.resourceUri).toBe(session.resource.uri);

    await workbench.resources.openResource(workspace.resource, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(workbench.layout.getLayout().areas.floating.widgets[0]?.resourceUri).toBe(session.resource.uri);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.workspaceSidebar).selectedNodeId).toBe(
      session.resource.uri,
    );

    await workbench.resources.openResource(dashboardResources.settings, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("settings");
    expect(workbench.layout.getLayout().areas.floating.widgets[0]?.resourceUri).toBe(session.resource.uri);
  });
});

describe("dashboard workbench session resource navigation", () => {
  test("opens session resources from the sessions sidebar mode", async () => {
    const workbench = createDashboardWorkbench();
    const session = dashboardSessions[0];

    await workbench.resources.openResource(dashboardResources.sessions, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("sessions");
    expect(resolveAreaPlacementIds(workbench, "floating")).toEqual([]);
    expect(resolveAreaPlacementIds(workbench, "floating-header")).toEqual([]);
    expect(resolveAreaPlacementIds(workbench, "left")).toEqual([dashboardWidgetIds.sessionsSidebar]);
    const sessionsSidebarBody = await workbench.renderers.getBody(dashboardWidgetIds.sessionsSidebar);
    expect(sessionsSidebarBody.flatMap((section) => section.nodes).map((node) => node.id)).toContain(
      session.resource.uri,
    );
    expect(sessionsSidebarBody.slice(1).map((section) => section.nodes.map((node) => node.id))).toEqual([
      ["dashboard-workbench://session/session-shell-review", "dashboard-workbench://session/session-sidebar-parity"],
      ["dashboard-workbench://session/session-list-mode"],
    ]);
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

  test("refreshes the sessions sidebar when synced session rows change", () => {
    const workbench = createDashboardWorkbench();
    const refreshedTreeIds: string[] = [];
    const disposable = workbench.renderers.onDidRefresh((event) => {
      refreshedTreeIds.push(event.treeId);
    });

    getWriter("sessions")?.upsert({
      id: "session-new",
      project_id: "project-1",
      title: "New synced session",
      status: "queued",
      archived: false,
      updated_at: "2026-05-23T12:00:00Z",
      created_at: "2026-05-23T12:00:00Z",
    });

    disposable.dispose();
    expect(refreshedTreeIds).toContain(dashboardWidgetIds.sessionsSidebar);
  });

  test("opens the latest session in sessions mode without a data renderer board", async () => {
    const workbench = createDashboardWorkbench();
    const session = dashboardSessions[0];

    await workbench.resources.openResource(dashboardResources.sessions, { replaceActive: true });

    expect(workbench.renderers.listDataRenderers().map((renderer) => renderer.id)).not.toContain(
      "dashboard-workbench.sessions",
    );
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.session);
    expect(workbench.layout.getLayout().areas.main.widgets[0]?.resourceUri).toBe(session.resource.uri);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.sessionsSidebar).selectedNodeId).toBe(
      session.resource.uri,
    );
  });

  test("loads a session into sessions mode when synced rows arrive after navigation", async () => {
    getWriter("sessions")?.truncateAndWrite([]);
    const workbench = createDashboardWorkbench();

    await workbench.resources.openResource(dashboardResources.sessions, { replaceActive: true });

    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.session);
    expect(workbench.layout.getLayout().areas.main.widgets[0]?.resourceUri).toBe(dashboardResources.sessions.uri);

    getWriter("sessions")?.upsert({
      id: "session-late",
      project_id: "project-1",
      title: "Late synced session",
      status: "queued",
      archived: false,
      updated_at: "2026-05-23T12:00:00Z",
      created_at: "2026-05-23T12:00:00Z",
    });

    expect(workbench.layout.getLayout().areas.main.widgets[0]?.resourceUri).toBe(
      "dashboard-workbench://session/session-late",
    );
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.sessionsSidebar).selectedNodeId).toBe(
      "dashboard-workbench://session/session-late",
    );
  });
});

describe("dashboard workbench create session command", () => {
  test("opens an empty session in the main view from sessions mode", async () => {
    const workbench = createDashboardWorkbench();
    const session = dashboardSessions[0];

    await workbench.resources.openResource(dashboardResources.sessions, { replaceActive: true });
    expect(workbench.layout.getLayout().areas.main.widgets[0]?.resourceUri).toBe(session.resource.uri);

    await workbench.commands.executeCommand("dashboard.createSession");

    const placement = workbench.layout.getLayout().areas.main.widgets[0];
    expect(placement?.contributionId).toBe(dashboardWidgetIds.session);
    expect(placement?.resourceUri).not.toBe(session.resource.uri);
    expect(placement?.resource?.kind).toBe("session-draft");
    expect(placement?.title).toBe("New session");
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.sessionsSidebar).selectedNodeId).toBeUndefined();
  });

  test("opens an empty session bubble outside sessions mode", async () => {
    const workbench = createDashboardWorkbench();
    const workspace = dashboardWorkspaces[0];

    await workbench.resources.openResource(workspace.resource, { replaceActive: true });
    expect(workbench.modes.getActiveModeId()).toBe("workspace");

    await workbench.commands.executeCommand("dashboard.createSession");

    const bubble = workbench.layout.getLayout().areas.floating.widgets[0];
    expect(bubble?.contributionId).toBe(dashboardWidgetIds.sessionBubble);
    expect(bubble?.resource?.kind).toBe("session-draft");
    expect(bubble?.title).toBe("New session");
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
