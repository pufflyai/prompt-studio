import { getCollection, type SyncedRow } from "@/lib/sync/collections";

export const workspaceState = (workspace: Partial<SyncedRow>) => {
  const providerError = workspace.provider_error_json as { message?: string } | undefined;
  if (workspace.setup_error || providerError?.message) return "failed";
  if (workspace.initializing) return "provisioning";
  const providerState = workspace.provider_state ?? "ready";
  if (providerState !== "ready") return String(providerState);
  if (workspace.execution_kind !== "remote" && !workspace.root_path)
    return workspace.is_default ? "unattached" : "unavailable";
  return "ready";
};

// A cloud project from another device has its data here, but its project folder is not on this device yet.
export const isProjectFolderMissing = (projectId: string) =>
  [...getCollection("workspaces").state.values()].some(
    (row) => row.project_id === projectId && row.is_default && !row.deleted_at && workspaceState(row) === "unattached",
  );
