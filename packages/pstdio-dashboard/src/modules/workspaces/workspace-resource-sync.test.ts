import { expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { createWorkbenchResourceActions } from "@pstdio/workbench/react";
import { getCollection, getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createWorkspacesModule } from "./module";

test("workspace links resolve current capabilities and retain their navigation metadata", () => {
  getCollection("workspaces");
  const row = {
    id: "linked-workspace",
    project_id: "workspace-sync-project",
    name: "Linked workspace",
    workspace_shorthand: "WS-1",
    provider_state: "ready",
    execution_kind: "local",
    is_default: false,
    provider_capabilities_json: { archive: true, delete: true, files: "write", diff: true },
  };
  getWriter("workspaces")!.upsert(row);
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: row.project_id, name: "Workspace sync" });
  workbench.pageLocations.setProject(row.project_id);
  workbench.pageLocations.navigate({
    kind: "page",
    page: workbenchPages.workspaces,
    resource: { type: "workspace", id: row.id, label: row.name, metadata: { workspaceView: "files" } },
  });
  const resource = workbench.getPrimaryResource()!;
  expect(resource.metadata).toMatchObject({
    workspaceSupportsArchive: true,
    workspaceSupportsDelete: true,
    workspaceView: "files",
  });
  expect(createWorkbenchResourceActions(workbench, resource).map((action) => action.label)).toContain(
    "Archive workspace",
  );
  expect(createWorkbenchResourceActions(workbench, resource).map((action) => action.label)).toContain(
    "Delete workspace",
  );
  getWriter("workspaces")!.upsert({ ...row, provider_capabilities_json: { archive: false, delete: false } });
  expect(workbench.getPrimaryResource()?.metadata).toMatchObject({
    workspaceSupportsArchive: false,
    workspaceSupportsDelete: false,
  });
  getWriter("workspaces")!.remove(row.id);
});
