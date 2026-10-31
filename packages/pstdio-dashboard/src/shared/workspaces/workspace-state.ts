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

// Rows carrying a device describe that machine's workspace, not this host's binding.
export const isDefaultWorkspaceOnThisDevice = (workspace: Partial<SyncedRow>) =>
  workspace.is_default && !workspace.deleted_at && !workspace.device;

export const isProjectWorkspaceReady = (projectId: string) =>
  [...getCollection("workspaces").state.values()].some(
    (row) => row.project_id === projectId && isDefaultWorkspaceOnThisDevice(row) && workspaceState(row) === "ready",
  );

// A cloud project from another device has its data here, but its project folder is not on this device yet.
export const isProjectFolderMissing = (projectId: string) =>
  [...getCollection("workspaces").state.values()].some(
    (row) =>
      row.project_id === projectId && isDefaultWorkspaceOnThisDevice(row) && workspaceState(row) === "unattached",
  );
