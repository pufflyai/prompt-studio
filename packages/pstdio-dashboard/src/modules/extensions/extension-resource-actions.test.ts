import { afterEach, expect, test } from "bun:test";
import { getCollection, getWriter } from "@/lib/sync/collections";
import { toDashboardExtensionResource } from "./extension-kanban-adapter";

const workspaceId = "tree-resource-workspace";
const projectId = "tree-resource-project";
afterEach(() => getWriter("workspaces")?.remove(workspaceId));

test("extension workspace resources use current host capabilities and keep their ticket parent", () => {
  getCollection("workspaces");
  const row = {
    id: workspaceId,
    project_id: projectId,
    name: "Current workspace name",
    workspace_shorthand: "WS-1",
    provider_state: "ready",
    execution_kind: "local",
    is_default: false,
    provider_capabilities_json: { archive: true, delete: true, files: "write", diff: true },
  };
  const parent = { type: "ticket", id: "parent-ticket", label: "Parent ticket" };
  const resource = { type: "workspace", id: workspaceId, metadata: { resourceParent: parent } };
  getWriter("workspaces")!.upsert(row);

  expect(toDashboardExtensionResource(resource, projectId)).toMatchObject({
    kind: "workspace",
    id: workspaceId,
    label: row.name,
    metadata: {
      resourceParent: parent,
      workspaceSupportsArchive: true,
      workspaceSupportsDelete: true,
      workspaceIsDefault: false,
    },
  });

  getWriter("workspaces")!.upsert({ ...row, is_default: true, provider_capabilities_json: { archive: false } });
  expect(toDashboardExtensionResource(resource, projectId)?.metadata).toMatchObject({
    workspaceSupportsArchive: false,
    workspaceSupportsDelete: false,
    workspaceIsDefault: true,
  });
});
