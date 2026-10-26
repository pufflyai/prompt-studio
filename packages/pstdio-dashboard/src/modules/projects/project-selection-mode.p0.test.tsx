import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createProjectsModule } from "./module";

const pickerPlacements = (workbench: ReturnType<typeof createWorkbench>) =>
  workbench.layout
    .listPanelInstances("overlay")
    .filter((placement) => placement.viewId === dashboardWidgetIds.projectPicker);

describe("required project selection", () => {
  test("opens a non-closable project picker while project selection is active", () => {
    const workbench = createWorkbench();
    workbench.registerModule(createProjectsModule());

    workbench.modes.setActiveMode("project-selection");

    expect(pickerPlacements(workbench)).toEqual([expect.objectContaining({ closable: false })]);
  });

  test("removes the required picker when project selection is left and restores it on re-entry", () => {
    const workbench = createWorkbench();
    workbench.registerModule(createProjectsModule());
    workbench.modes.setActiveMode("project-selection");

    workbench.modes.setActiveMode(undefined);
    expect(pickerPlacements(workbench)).toEqual([]);

    workbench.modes.setActiveMode("project-selection");
    expect(pickerPlacements(workbench)).toEqual([expect.objectContaining({ closable: false })]);
  });

  test("keeps project creation available above the required picker", async () => {
    const workbench = createWorkbench();
    workbench.registerModule(createProjectsModule());
    workbench.modes.setActiveMode("project-selection");

    await workbench.commands.executeCommand(dashboardCommandIds.createProject);

    expect(workbench.layout.listPanelInstances("overlay")).toEqual([
      expect.objectContaining({ viewId: dashboardWidgetIds.projectPicker, closable: false }),
      expect.objectContaining({ viewId: dashboardWidgetIds.createProject, closable: true }),
    ]);
    expect(workbench.layout.getActivePanel("overlay")?.viewId).toBe(dashboardWidgetIds.createProject);
  });
});
