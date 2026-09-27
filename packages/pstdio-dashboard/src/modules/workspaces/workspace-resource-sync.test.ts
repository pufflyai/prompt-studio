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
    page: workbenchPages.workspace,
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

test("a workspace opened without an icon shows its kind's icon in the breadcrumb", () => {
  getCollection("workspaces");
  const row = {
    id: "ticket-linked-folder",
    project_id: "workspace-icon-project",
    name: "Project workspace",
    workspace_shorthand: "WS-2",
    provider_id: "pstdio.root",
    provider_state: "ready",
    execution_kind: "local",
    is_default: true,
    provider_capabilities_json: { files: "write", diff: false },
  };
  getWriter("workspaces")!.upsert(row);
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: row.project_id, name: "Workspace icons" });
  workbench.pageLocations.setProject(row.project_id);
  // Tool sidebars link a workspace by identity only, as the Planner ticket tree does.
  workbench.pageLocations.navigate({
    kind: "page",
    page: workbenchPages.workspace,
    resource: { type: "workspace", id: row.id, label: row.name },
  });

  expect(workbench.getPrimaryResource()?.icon).toBe("Folder");
  expect(workbench.breadcrumbs.getItems()?.at(-1)?.icon).toBe("Folder");
  getWriter("workspaces")!.remove(row.id);
});

test("an archived workspace opened by identity still shows its kind's icon", () => {
  getCollection("workspaces");
  const row = {
    id: "archived-worktree",
    project_id: "workspace-archived-icon-project",
    name: "Archived attempt",
    workspace_shorthand: "WS-3",
    provider_id: "pstdio.worktree",
    provider_state: "ready",
    execution_kind: "local",
    archived: true,
  };
  getWriter("workspaces")!.upsert(row);
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: row.project_id, name: "Archived icons" });
  workbench.pageLocations.setProject(row.project_id);
  workbench.pageLocations.navigate({
    kind: "page",
    page: workbenchPages.workspace,
    resource: { type: "workspace", id: row.id, label: row.name },
  });

  expect(workbench.breadcrumbs.getItems()?.at(-1)?.icon).toBe("GitBranch");
  getWriter("workspaces")!.remove(row.id);
});
