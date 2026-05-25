import { beforeEach, describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createDashboardExampleModules } from "./dashboard-workbench";
import { createDashboardProjects } from "./modules/projects/data/project-data";
import type { DashboardWorkspace } from "./modules/workspaces/data/dashboard-workspaces";
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

const createWorkbenchWithoutProject = () => {
  const workbench = createWorkbenchCore();
  for (const module of createDashboardExampleModules()) workbench.registerModule(module);
  return workbench;
};

const getFloatingSessionResourceUri = (workbench: ReturnType<typeof createWorkbenchCore>) =>
  workbench.layout
    .getLayout()
    .areas.floating.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble)?.resourceUri;

const getAreaContributionIds = (
  workbench: ReturnType<typeof createWorkbenchCore>,
  area: keyof ReturnType<ReturnType<typeof createWorkbenchCore>["layout"]["getLayout"]>["areas"],
) => workbench.layout.getLayout().areas[area].widgets.map((placement) => placement.contributionId);

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

  test("clears project-scoped placements while keeping dashboard chrome when switching projects", async () => {
    const workbench = await createWorkbench("project-1");
    const project = createDashboardProjects().find((entry) => entry.id === "project-2");

    if (!project) throw new Error("Missing project: project-2");

    workbench.layout.registerWidget({
      id: "test.global-top-placement",
      title: "Global top placement",
      area: "top",
      rendererId: "test.global-top-placement",
    });
    workbench.layout.registerWidget({
      id: "test.global-status-placement",
      title: "Global status placement",
      area: "status",
      rendererId: "test.global-status-placement",
    });
    workbench.layout.openWidget("test.global-top-placement");
    workbench.layout.openWidget("test.global-status-placement");

    expect(getAreaContributionIds(workbench, "top")).toContain(dashboardWidgetIds.header);
    expect(getAreaContributionIds(workbench, "left-header")).toContain(dashboardWidgetIds.leftHeader);
    expect(getAreaContributionIds(workbench, "top")).toContain("test.global-top-placement");
    expect(getAreaContributionIds(workbench, "status")).toContain("test.global-status-placement");

    await workbench.resources.openResource(project.resource, { replaceActive: true });

    expect(getAreaContributionIds(workbench, "top")).toContain(dashboardWidgetIds.header);
    expect(getAreaContributionIds(workbench, "left-header")).toContain(dashboardWidgetIds.leftHeader);
    expect(getAreaContributionIds(workbench, "top")).not.toContain("test.global-top-placement");
    expect(getAreaContributionIds(workbench, "status")).not.toContain("test.global-status-placement");
  });

  test("keeps dashboard chrome from project selection when selecting a project", async () => {
    const workbench = createWorkbenchWithoutProject();
    const project = createDashboardProjects().find((entry) => entry.id === "project-2");

    if (!project) throw new Error("Missing project: project-2");

    expect(workbench.modes.getActiveModeId()).toBe("project-selection");
    expect(getAreaContributionIds(workbench, "top")).toContain(dashboardWidgetIds.header);
    expect(getAreaContributionIds(workbench, "left-header")).toContain(dashboardWidgetIds.leftHeader);

    await workbench.resources.openResource(project.resource, { replaceActive: true });

    expect(workbench.context.get(dashboardSelectedProjectIdContextKey)).toBe("project-2");
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(getAreaContributionIds(workbench, "top")).toContain(dashboardWidgetIds.header);
    expect(getAreaContributionIds(workbench, "left-header")).toContain(dashboardWidgetIds.leftHeader);
    expect(getAreaContributionIds(workbench, "overlay")).not.toContain(dashboardWidgetIds.projectPicker);
  });
});
