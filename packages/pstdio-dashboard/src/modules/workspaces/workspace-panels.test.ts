import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "./module";

test("keeps Files and Changes fixed and bound to the current workspace", () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });

  for (const workspaceId of ["workspace-1", "workspace-2", "workspace-1"]) {
    const workspace = createDashboardResource("workspace", workspaceId, "Workspace", "GitBranch", "project-1");
    openWorkspacesPage(workbench, workspace);
    const panels = workbench.layout.listPanelInstances("main");
    expect(panels).toEqual([
      expect.objectContaining({ viewId: dashboardWidgetIds.workspaceDiffs, closable: false, resource: workspace }),
      expect.objectContaining({ viewId: dashboardWidgetIds.workspaceFiles, closable: false, resource: workspace }),
    ]);
    for (const panel of panels) {
      workbench.layout.activatePanel(panel.instanceId);
      expect(workbench.getPrimaryResource()).toEqual(workspace);
    }
  }
});
