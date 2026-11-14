import type { WorkspacesRouteDeps } from "./deps";
import { observeWorkspaceChanges } from "./workspace-observation";

export const observeWorkspaceDiff = (
  deps: Pick<WorkspacesRouteDeps, "workspaceService" | "eventBus">,
  input: { project_id: string; workspace_id: string },
  changed: (event: "changed" | "closed") => void,
) => observeWorkspaceChanges(deps, input, changed, "diff");
