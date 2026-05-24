import { describe, expect, test } from "bun:test";
import type { WorkbenchStorageLike } from "pstdio-workbench/storage";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { createDashboardWorkbench } from "./dashboard-workbench";
import { createDashboardProjects } from "./modules/projects/data/project-data";
import { dashboardSelectedProjectIdContextKey } from "./shared/project-context";
import { createDashboardResource, dashboardResources } from "./shared/resources";
import { dashboardWidgetIds } from "./shared/widget-ids";
import { seedDashboardWorkbenchRows } from "./test-utils/dashboard-data-fixture";

const createMemoryStorage = (): WorkbenchStorageLike => {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

const clearProjectRows = () => {
  const writer = getWriter("projects");
  if (!writer) throw new Error("Missing writer for projects");
  writer.truncateAndWrite([]);
};

describe("dashboard workbench template", () => {
  test("boots into project selection when no project was selected", () => {
    const workbench = createDashboardWorkbench({ storage: createMemoryStorage() });
    const layout = workbench.layout.getLayout();

    expect(workbench.modes.getActiveModeId()).toBe("project-selection");
    expect(layout.areas.overlay.widgets).toEqual([
      expect.objectContaining({
        contributionId: dashboardWidgetIds.projectPicker,
        closable: false,
      }),
    ]);
    expect(layout.areas.left.widgets).toEqual([]);
    expect(layout.areas.main.widgets).toEqual([]);
    expect(layout.areas.top.widgets.map((widget) => widget.contributionId)).toContain(dashboardWidgetIds.header);
  });

  test("restores the last selected project from storage", async () => {
    seedDashboardWorkbenchRows();
    const storage = createMemoryStorage();
    const firstWorkbench = createDashboardWorkbench({ storage });
    const project = createDashboardProjects().find((entry) => entry.id === "project-2");

    expect(project).toBeDefined();

    await firstWorkbench.resources.openResource(project!.resource, { replaceActive: true });

    const secondWorkbench = createDashboardWorkbench({ storage });

    expect(secondWorkbench.context.get(dashboardSelectedProjectIdContextKey)).toBe("project-2");
    expect(secondWorkbench.modes.getActiveModeId()).toBe("project");
    expect(secondWorkbench.layout.getLayout().activeResourceUri).toBe(dashboardResources.workspaces.uri);
  });

  test("waits for the persisted project to sync before leaving startup", async () => {
    seedDashboardWorkbenchRows();
    const storage = createMemoryStorage();
    const firstWorkbench = createDashboardWorkbench({ storage });
    const project = createDashboardProjects().find((entry) => entry.id === "project-2");

    expect(project).toBeDefined();

    await firstWorkbench.resources.openResource(project!.resource, { replaceActive: true });
    clearProjectRows();

    const secondWorkbench = createDashboardWorkbench({ storage });

    expect(secondWorkbench.modes.getActiveModeId()).toBeUndefined();
    expect(secondWorkbench.layout.getLayout().areas.overlay.widgets).toEqual([]);

    seedDashboardWorkbenchRows();
    await Promise.resolve();

    expect(secondWorkbench.modes.getActiveModeId()).toBeUndefined();

    markInitialCollectionsSyncComplete();
    await Promise.resolve();

    expect(secondWorkbench.context.get(dashboardSelectedProjectIdContextKey)).toBe("project-2");
    expect(secondWorkbench.modes.getActiveModeId()).toBe("project");
    expect(secondWorkbench.layout.getLayout().activeResourceUri).toBe(dashboardResources.workspaces.uri);
  });

  test("opens a newly-created project resource before synced project rows arrive", async () => {
    const workbench = createDashboardWorkbench({ storage: createMemoryStorage() });
    const createdProject = createDashboardResource(
      "project",
      "project-new",
      "New Project",
      "FolderGit2",
      "project-new",
    );

    await workbench.resources.openResource(createdProject, { replaceActive: true });

    const overlayContributionIds = workbench.layout
      .getLayout()
      .areas.overlay.widgets.map((placement) => placement.contributionId);

    expect(workbench.context.get(dashboardSelectedProjectIdContextKey)).toBe("project-new");
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().activeResourceUri).toBe(dashboardResources.workspaces.uri);
    expect(overlayContributionIds).not.toContain(dashboardWidgetIds.projectPicker);
    expect(overlayContributionIds).not.toContain(dashboardWidgetIds.createProject);
  });

  test("restores tree view expansion from storage", () => {
    const storage = createMemoryStorage();
    const firstWorkbench = createDashboardWorkbench({ storage });

    firstWorkbench.renderers.setSectionExpanded(dashboardWidgetIds.workspaceSidebar, "sessions", false);

    const secondWorkbench = createDashboardWorkbench({ storage });

    expect(secondWorkbench.renderers.getTreeState(dashboardWidgetIds.workspaceSidebar).expandedSectionIds).toEqual([]);
  });
});
