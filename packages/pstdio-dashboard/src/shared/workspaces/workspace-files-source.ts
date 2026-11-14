import { contributionRefId, type ResourceRef, workspaceViews } from "@pstdio/sdk/extensions";
import type { RuntimeCollections } from "@/lib/sync/collections";
import { createWorkspaceChangeSource } from "./workspace-change-source";
import { workspaceState } from "./workspace-state";

/** The observed tree query owns its hint source, including row readiness and runtime teardown. */
export const subscribeWorkspaceFileTree = (
  owner: RuntimeCollections,
  resource: ResourceRef | undefined,
  invalidate: () => void,
) => {
  if (owner.isDisposed() || !resource || resource.device) return () => {};
  let source: ReturnType<typeof createWorkspaceChangeSource> | undefined;
  let location: string | undefined;
  const sync = () => {
    const row = owner.getCollection("workspaces").get(resource.id);
    const capabilities = row?.provider_capabilities_json as { files?: string } | undefined;
    const ready =
      row &&
      !row.deleted_at &&
      !row.device &&
      row.project_id === resource.projectId &&
      row.execution_kind === "local" &&
      workspaceState(row) === "ready" &&
      row.root_path &&
      capabilities?.files !== "none";
    const next = ready ? JSON.stringify([row.project_id, row.root_path]) : undefined;
    if (location === next) return;
    source?.close();
    location = next;
    source = ready
      ? createWorkspaceChangeSource(owner, resource.id, String(row.project_id), invalidate, "files")
      : undefined;
  };
  const stopRows = owner.subscribeCollections((change) => {
    if (!change || (change.table === "workspaces" && change.changes.some((row) => row.key === resource.id))) sync();
  });
  sync();
  const close = () => {
    stopRows();
    source?.close();
  };
  const stopRuntime = owner.onDispose(close);
  return () => {
    stopRuntime();
    close();
  };
};

export const workspaceTreeSources = (owner: RuntimeCollections) =>
  new Map([
    [
      contributionRefId(workspaceViews.tree),
      (resource: ResourceRef | undefined, invalidate: () => void) =>
        subscribeWorkspaceFileTree(owner, resource, invalidate),
    ],
  ]);
