import type { SyncedRow } from "@/lib/sync/collections";

export const workspaceState = (workspace: Partial<SyncedRow>) => {
  if (workspace.setup_error) return "failed";
  if (workspace.initializing) return "provisioning";
  const providerState = workspace.provider_state ?? "ready";
  if (providerState !== "ready") return String(providerState);
  if (workspace.execution_kind !== "remote" && !workspace.root_path)
    return workspace.is_default ? "unattached" : "unavailable";
  return "ready";
};
