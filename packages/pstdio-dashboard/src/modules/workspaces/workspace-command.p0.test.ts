import { expect, test } from "bun:test";
import { type CreateWorkspaceCommandParams, commandRef } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createWorkspacesModule } from "./module";

test("the public workspace command opens the provider form with resource anchors", async () => {
  const command = commandRef<CreateWorkspaceCommandParams>({
    extensionId: "pstdio",
    id: "workbench.workspace.create",
  });
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  const params = { anchors: [{ type: "ticket", id: "ticket-1", role: "primary" as const }], shorthand_base: "T-1" };
  await workbench.commands.executeCommand(command.id, params);
  const overlay = workbench.layout.getActivePanel("overlay");
  expect(overlay?.viewId).toBe(dashboardWidgetIds.createWorkspace);
  expect(overlay?.resource?.metadata).toEqual(params);
});
