import { expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardViews } from "@/shared/app/resources";
import { createWorkspacesModule } from "./module";

test("opens the Workspaces view and workspace resources with stable identities", async () => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

  await workbench.views.openView(dashboardViews.workspaces.id);

  expect(workbench.modes.getActiveModeId()).toBe("project");
  expect(workbench.layout.getLayout().regions.main.widgets[0]?.viewId).toBe(dashboardViews.workspaces.id);
  expect(workbench.getPrimaryResource()).toBeUndefined();

  const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
    workspaceId: "workspace-1",
    workspaceShorthand: "PS-307_A1",
  });
  await workbench.resources.openResource(workspace, { replaceActive: true });

  expect(workbench.modes.getActiveModeId()).toBe("project");
  expect(workbench.getPrimaryResource()?.uri).toBe(workspace.uri);
});
