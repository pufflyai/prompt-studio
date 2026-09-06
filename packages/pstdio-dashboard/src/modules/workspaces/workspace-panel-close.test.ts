import { expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "./module";

for (const first of [dashboardWidgetIds.workspaceFiles, dashboardWidgetIds.workspaceDiffs]) {
  test(`closes ${first} independently and reopens both workspace panels`, () => {
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Project" });
    const workspace = createDashboardResource("workspace", "workspace-1", "Workspace", "GitBranch", "project-1");
    openWorkspacesPage(workbench, workspace);
    const location = workbench.pages.store.getState().location;
    const second =
      first === dashboardWidgetIds.workspaceFiles
        ? dashboardWidgetIds.workspaceDiffs
        : dashboardWidgetIds.workspaceFiles;
    const close = (viewId: string) => {
      const panel = workbench.layout.getLayout().regions.main.widgets.find((item) => item.viewId === viewId)!;
      workbench.layout.activatePanel(panel.widgetId);
      expect(workbench.pageLocations.closePlacement(panel.placementIdentity!).ok).toBe(true);
      expect(workbench.pages.store.getState().location).toEqual(location);
      expect(workbench.layout.getLayout().regions.main.widgets.some((item) => item.viewId === viewId)).toBe(false);
    };

    close(first);
    expect(workbench.layout.getActivePanel("main")?.viewId).toBe(second);
    close(second);
    expect(workbench.layout.getActivePanel("main")?.viewId).toBe(dashboardWidgetIds.workspace);
    for (const slotId of ["changes", "files"]) {
      workbench.pages.openSlot({
        pageId: workbenchPages.workspace.id,
        slotId,
        resource: { type: "workspace", id: "workspace-1" },
      });
    }
    expect(workbench.layout.getLayout().regions.main.widgets.map((item) => item.viewId)).toEqual([
      dashboardWidgetIds.workspaceDiffs,
      dashboardWidgetIds.workspaceFiles,
    ]);
    expect(workbench.pages.store.getState().location).toEqual(location);
  });
}
