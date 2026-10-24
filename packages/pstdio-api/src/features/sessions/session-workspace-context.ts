import type { HarnessWorkspaceContext, WorkspaceProviderRef } from "pstdio-api-contracts";
import { ProjectFolderMissingError } from "../projects/project-folder-missing";

type WorkspaceRecord = {
  id: string;
  provider_id?: string;
  provider_ref_json?: { version: number; data: Record<string, unknown> } | null;
  execution_kind?: "local" | "remote";
  display_path?: string | null;
  root_path?: string | null;
  is_default?: boolean;
};

// A harness that needs no folder runs without one in a project whose folder is not on this device yet.
export const toHarnessWorkspaceContext = (
  workspace: WorkspaceRecord | null | undefined,
  cwdRequirement: "required" | "optional" = "required",
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

  const rootPath = workspace.root_path;
  if (!rootPath && workspace.is_default) {
    if (cwdRequirement === "optional") return undefined;
    throw new ProjectFolderMissingError();
  }
  if (!rootPath) throw new Error(`Workspace ${workspace.id} has no local execution target.`);

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
  cwdRequirement?: "required" | "optional",
) => toHarnessWorkspaceContext(await workspaceSessionService.getWorkspaceBySessionId(sessionId), cwdRequirement);
