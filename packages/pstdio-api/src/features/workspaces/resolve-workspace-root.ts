import type { WorkspacesRouteDeps } from "./deps";
import { resolveWorkspaceExecutionTarget } from "./workspace-provider-service";

export const resolveWorkspaceRoot = (deps: WorkspacesRouteDeps, workspaceId: string) =>
  resolveWorkspaceExecutionTarget(deps, workspaceId);
