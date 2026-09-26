import type { SyncedRow } from "@/lib/sync/collections";

export const workspaceState = (workspace: Partial<SyncedRow>) => {
  const providerError = workspace.provider_error_json as { message?: string } | undefined;
  if (workspace.setup_error || providerError?.message) return "failed";
  if (workspace.initializing) return "provisioning";
  return String(workspace.provider_state ?? "ready");
};
