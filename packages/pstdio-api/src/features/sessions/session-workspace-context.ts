import type { HarnessWorkspaceContext, WorkspaceProviderRef } from "pstdio-api-contracts";

type WorkspaceRecord = {
  id: string;
  provider_id?: string;
  provider_ref_json?: { version: number; data: Record<string, unknown> } | null;
  execution_kind?: "local" | "remote";
  display_path?: string | null;
  worktree_path?: string | null;
};

export const toHarnessWorkspaceContext = (
  workspace: WorkspaceRecord | null | undefined,
  cwd?: string,
): HarnessWorkspaceContext | undefined => {
  if (!workspace) return undefined;

  if (workspace.execution_kind === "remote") {
    if (!workspace.provider_id || !workspace.provider_ref_json) {
      throw new Error(`Remote workspace ${workspace.id} has no provider reference.`);
    }

    return {
      workspaceId: workspace.id,
      executionTarget: {
        kind: "remote",
        providerId: workspace.provider_id,
        providerRef: workspace.provider_ref_json as WorkspaceProviderRef,
        ...(workspace.display_path ? { displayPath: workspace.display_path } : {}),
      },
    };
  }

  const rootPath = workspace.worktree_path ?? cwd;
  if (!rootPath) return undefined;

  return {
    workspaceId: workspace.id,
    executionTarget: {
      kind: "local",
      rootPath,
      ...(workspace.display_path ? { displayPath: workspace.display_path } : {}),
    },
  };
};

export const resolveSessionWorkspaceContext = async (
  workspaceSessionService: {
    getWorkspaceBySessionId(sessionId: string): Promise<WorkspaceRecord | null>;
  },
  sessionId: string,
  cwd?: string,
) => toHarnessWorkspaceContext(await workspaceSessionService.getWorkspaceBySessionId(sessionId), cwd);
