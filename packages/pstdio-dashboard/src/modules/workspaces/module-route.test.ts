import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "./module";

test("opens the Workspaces view and workspace resources with stable identities", async () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

  openWorkspacesPage(workbench);

  expect(workbench.modes.getActiveModeId()).toBe("project");
  expect(workbench.layout.getLayout().regions.main.widgets[0]?.viewId).toBe(dashboardWidgetIds.workspaces);
  expect(workbench.getPrimaryResource()).toBeUndefined();

  const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
    workspaceId: "workspace-1",
    workspaceShorthand: "PS-307_A1",
  });
  openWorkspacesPage(workbench, workspace);

  expect(workbench.modes.getActiveModeId()).toBe("project");
  expect(workbench.getPrimaryResource()?.uri).toBe(workspace.uri);
});
