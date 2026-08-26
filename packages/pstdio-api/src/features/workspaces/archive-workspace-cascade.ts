import type { WorkspacesRouteDeps } from "./deps";
import { archiveProviderBackedWorkspace } from "./workspace-provider-lifecycle";

type WorkspaceRecord = NonNullable<Awaited<ReturnType<WorkspacesRouteDeps["workspaceService"]["get"]>>>;

export const archiveWorkspaceCascade = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
): Promise<WorkspaceRecord> => archiveProviderBackedWorkspace(deps, workspace);
