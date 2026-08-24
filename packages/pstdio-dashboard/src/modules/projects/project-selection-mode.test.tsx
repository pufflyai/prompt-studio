import { describe, expect, test } from "bun:test";
import {
  createWorkbenchCore,
  type WorkbenchPersistenceAdapter,
  type WorkbenchRegion,
  type WorkbenchSnapshot,
  workbenchRegions,
} from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createProjectsModule } from "./module";

const findProjectPicker = (workbench: ReturnType<typeof createWorkbenchCore>) =>
  workbench.layout
    .getLayout()
    .regions.overlay.widgets.find((placement) => placement.contributionId === dashboardWidgetIds.projectPicker);

const registerAndOpenTestPanel = (
  workbench: ReturnType<typeof createWorkbenchCore>,
  region: WorkbenchRegion,
  id = `test.${region}`,
) => {
  workbench.layout.registerPanel({ id, title: id, region, rendererId: "noop" });
  return workbench.layout.openPanel(id, { pinned: true, closable: true });
};

describe("required project selection", () => {
  test("keeps project selection open when no project is selected", () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createProjectsModule());

    workbench.modes.setActiveMode("project-selection");

    expect(findProjectPicker(workbench)?.closable).toBe(false);
  });

  test("keeps the project selector and required picker when entering project selection", () => {
    const workbench = createWorkbenchCore();
    for (const region of workbenchRegions) registerAndOpenTestPanel(workbench, region);
    registerAndOpenTestPanel(workbench, "nav", dashboardWidgetIds.projectHeader);
    workbench.registerModule(createProjectsModule());

    workbench.modes.setActiveMode("project-selection");

    for (const region of workbenchRegions) {
      const placements = workbench.layout.getLayout().regions[region].widgets;
      if (region === "overlay") {
        expect(placements.map((placement) => placement.contributionId)).toEqual([dashboardWidgetIds.projectPicker]);
      } else if (region === "nav") {
        expect(placements.map((placement) => placement.contributionId)).toEqual([dashboardWidgetIds.projectHeader]);
      } else {
        expect(placements).toEqual([]);
      }
    }
  });

  test("restores required project selection from a saved layout where it was closed", () => {
    const snapshots = new Map<string | undefined, WorkbenchSnapshot>();
    const persistence = {
      getSnapshot: (scope) => snapshots.get(scope),
      setSnapshot: (snapshot, scope) => snapshots.set(scope, structuredClone(snapshot)),
    } satisfies WorkbenchPersistenceAdapter;
    const previousWorkbench = createWorkbenchCore({ persistence });
    previousWorkbench.registerModule(createProjectsModule());
    previousWorkbench.modes.setActiveMode("project-selection");

    const previousProjectPicker = findProjectPicker(previousWorkbench);
    expect(previousProjectPicker).toBeDefined();
    previousWorkbench.layout.removeWidgetPlacement(previousProjectPicker!.widgetId);

    const restoredWorkbench = createWorkbenchCore({ persistence });
    restoredWorkbench.registerModule(createProjectsModule());
    restoredWorkbench.modes.setActiveMode("project-selection");

    expect(findProjectPicker(restoredWorkbench)?.closable).toBe(false);
  });

  test("repairs saved project selection chrome without hiding project creation", async () => {
    const snapshots = new Map<string | undefined, WorkbenchSnapshot>();
    const persistence = {
      getSnapshot: (scope) => snapshots.get(scope),
      setSnapshot: (snapshot, scope) => snapshots.set(scope, structuredClone(snapshot)),
    } satisfies WorkbenchPersistenceAdapter;
    const previousWorkbench = createWorkbenchCore({ persistence });
    registerAndOpenTestPanel(previousWorkbench, "nav", dashboardWidgetIds.projectHeader);
    registerAndOpenTestPanel(previousWorkbench, "nav", "test.stale-nav");
    registerAndOpenTestPanel(previousWorkbench, "status", "test.stale-status");
    registerAndOpenTestPanel(previousWorkbench, "overlay", "test.stale-overlay");
    previousWorkbench.registerModule(createProjectsModule());
    previousWorkbench.modes.setActiveMode("project-selection");
    registerAndOpenTestPanel(previousWorkbench, "nav", "test.saved-nav");
    registerAndOpenTestPanel(previousWorkbench, "status", "test.saved-status");
    previousWorkbench.layout.openPanel("test.stale-overlay", { pinned: true, closable: true });
    await previousWorkbench.commands.executeCommand(dashboardCommandIds.createProject);

    const previousProjectPicker = findProjectPicker(previousWorkbench);
    const previousCreateProject = previousWorkbench.layout
      .getLayout()
      .regions.overlay.widgets.find((placement) => placement.contributionId === dashboardWidgetIds.createProject);
    expect(previousProjectPicker).toBeDefined();
    expect(previousCreateProject).toBeDefined();
    previousWorkbench.layout.updateWidgetPlacement(previousProjectPicker!.widgetId, { closable: true });
    previousWorkbench.layout.activateWidget(previousCreateProject!.widgetId);

    const restoredWorkbench = createWorkbenchCore({ persistence });
    restoredWorkbench.layout.registerPanel({
      id: dashboardWidgetIds.projectHeader,
      title: dashboardWidgetIds.projectHeader,
      region: "nav",
      rendererId: "noop",
    });
    restoredWorkbench.layout.registerPanel({
      id: "test.saved-nav",
      title: "test.saved-nav",
      region: "nav",
      rendererId: "noop",
    });
    restoredWorkbench.layout.registerPanel({
      id: "test.saved-status",
      title: "test.saved-status",
      region: "status",
      rendererId: "noop",
    });
    restoredWorkbench.layout.registerPanel({
      id: "test.stale-overlay",
      title: "test.stale-overlay",
      region: "overlay",
      rendererId: "noop",
    });
    restoredWorkbench.registerModule(createProjectsModule());
    restoredWorkbench.modes.setActiveMode("project-selection");

    for (const region of workbenchRegions.filter((region) => region !== "overlay")) {
      const placements = restoredWorkbench.layout.getLayout().regions[region].widgets;
      if (region === "nav") {
        expect(placements.map((placement) => placement.contributionId)).toEqual([dashboardWidgetIds.projectHeader]);
      } else {
        expect(placements).toEqual([]);
      }
    }
    expect(
      restoredWorkbench.layout.getLayout().regions.overlay.widgets.map((placement) => placement.contributionId),
    ).toEqual([dashboardWidgetIds.projectPicker, dashboardWidgetIds.createProject]);
    expect(findProjectPicker(restoredWorkbench)?.closable).toBe(false);
    expect(restoredWorkbench.layout.getLayout().regions.overlay.activeWidgetId).toBe(previousCreateProject!.widgetId);
  });
});
