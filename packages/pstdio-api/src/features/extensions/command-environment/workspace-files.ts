import type { ExtensionsRouteDeps } from "../deps";

export type FileAccess = "read" | "write";

export const resolveWorkspaceFilesPath = async (
  deps: Pick<ExtensionsRouteDeps, "workspaceService">,
  input: { projectId: string; workspaceId?: string; provisioningWorkspaceId?: string },
  access: FileAccess,
) => {
  const workspace = input.workspaceId
    ? await deps.workspaceService.get(input.workspaceId)
    : await deps.workspaceService.getDefault(input.projectId);
  if (!workspace || workspace.project_id !== input.projectId) throw new Error("Workspace not found for project.");
  const provisioning = workspace.id === input.provisioningWorkspaceId;
  if (
    workspace.deleted_at ||
    workspace.provider_state !== "ready" ||
    (!provisioning && (workspace.initializing || workspace.setup_error))
  )
    throw new Error("Workspace files are not ready.");
  if (workspace.execution_kind !== "local" || !workspace.root_path)
    throw new Error("This workspace has no local file target.");
  const files = workspace.provider_capabilities_json.files;
  if (files === "none" || (access === "write" && files !== "write"))
    throw new Error(`Workspace provider does not allow file ${access} access.`);
  return workspace.root_path;
};
