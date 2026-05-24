import { beforeEach, describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { createDashboardExampleModules } from "./dashboard-workbench";
import type { DashboardWorkspace } from "./data/dashboard-data";
import { createDashboardProjects } from "./data/project-data";
import { dashboardSelectedProjectIdContextKey } from "./shared/project-context";
import { dashboardResources } from "./shared/resources";
import { dashboardWidgetIds } from "./shared/widget-ids";
import { seedDashboardWorkbenchRows } from "./test-utils/dashboard-data-fixture";

let dashboardWorkspaces: DashboardWorkspace[] = [];

const createWorkbench = async (selectedProjectId: string) => {
  const workbench = createWorkbenchCore();
  for (const module of createDashboardExampleModules()) workbench.registerModule(module);

  const project = createDashboardProjects().find((entry) => entry.id === selectedProjectId);
  if (!project) throw new Error(`Missing project: ${selectedProjectId}`);

  await workbench.resources.openResource(project.resource, { replaceActive: true });
  return workbench;
};

const getFloatingSessionResourceUri = (workbench: ReturnType<typeof createWorkbenchCore>) =>
  workbench.layout
    .getLayout()
    .areas.floating.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble)?.resourceUri;

beforeEach(() => {
  dashboardWorkspaces = seedDashboardWorkbenchRows().dashboardWorkspaces;
});

describe("dashboard project switching", () => {
  test("clears project-scoped session data when switching projects from the workspaces board", async () => {
    const workbench = await createWorkbench("project-1");
    const workspace = dashboardWorkspaces.find((entry) => entry.id === "workspace-1");
    const project = createDashboardProjects().find((entry) => entry.id === "project-2");

    if (!workspace) throw new Error("Missing workspace: workspace-1");
    if (!project) throw new Error("Missing project: project-2");

    const projectSessionUri = workspace.sessions[0]?.resource.uri;

    await workbench.resources.openResource(workspace.resource, { replaceActive: true });
    expect(getFloatingSessionResourceUri(workbench)).toBe(projectSessionUri);

    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(getFloatingSessionResourceUri(workbench)).toBe(projectSessionUri);

    await workbench.resources.openResource(project.resource, { replaceActive: true });

    expect(workbench.context.get(dashboardSelectedProjectIdContextKey)).toBe("project-2");
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().activeResourceUri).toBe(dashboardResources.workspaces.uri);
    expect(getFloatingSessionResourceUri(workbench)).toBeUndefined();
  });
});
