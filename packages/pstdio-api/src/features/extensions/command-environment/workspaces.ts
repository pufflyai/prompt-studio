import type {
  CreateExtensionWorkspaceInput,
  ExtensionWorkspace,
  WorkspaceProviderRef,
} from "pstdio-api-contracts/extension-kernel";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import { archiveWorkspaceCascade } from "../../workspaces/archive-workspace-cascade";
import type { WorkspacesRouteDeps } from "../../workspaces/deps";
import {
  cancelProviderBackedWorkspace,
  deleteProviderBackedWorkspace,
} from "../../workspaces/workspace-provider-lifecycle";
import {
  createProviderBackedWorkspace,
  rootProviderId,
  worktreeProviderId,
} from "../../workspaces/workspace-provider-service";
import type { ExtensionsRouteDeps } from "../deps";
import type { CommandEnvironmentRuntimeDeps } from "./types";

const resolveRepoForWorkspace = async (deps: ExtensionsRouteDeps, projectId: string, repoId: unknown) => {
  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length === 0) throw new Error(`Repo not found for project ${projectId}`);
  if (typeof repoId === "string" && repoId.trim()) {
    const repo = repos.find((candidate) => candidate.id === repoId);
    if (!repo) throw new Error(`Repo not found: ${repoId}`);
    return repo;
  }
  return repos[0]!;
};

export const createExtensionWorkspace = async (
  deps: ExtensionsRouteDeps,
  input: {
    projectId: string;
    workspaceInput: CreateExtensionWorkspaceInput;
  },
  runtimeDeps: CommandEnvironmentRuntimeDeps,
) => {
  const projectId = input.workspaceInput.project_id ?? input.projectId;
  const anchors = input.workspaceInput.anchors ?? [];
  const shorthandBase = input.workspaceInput.shorthand_base;
  if (!shorthandBase) throw new Error("Workspace creation requires shorthand_base");

  const mode = input.workspaceInput.mode === "current_branch" ? "current_branch" : "worktree";
  const providerId =
    typeof input.workspaceInput.provider_id === "string"
      ? input.workspaceInput.provider_id
      : mode === "current_branch"
        ? rootProviderId
        : worktreeProviderId;
  const params = input.workspaceInput.params ?? {};
  const providerParams = {
    ...params,
    ...(input.workspaceInput.repo_id ? { repo_id: input.workspaceInput.repo_id } : {}),
    ...(input.workspaceInput.base ? { base: input.workspaceInput.base } : {}),
  };
  const repo =
    providerId === rootProviderId || providerId === worktreeProviderId
      ? await resolveRepoForWorkspace(deps, projectId, input.workspaceInput.repo_id)
      : null;
  const workspace = await createProviderBackedWorkspace(deps as WorkspacesRouteDeps, {
    projectId,
    shorthandBase,
    anchors,
    providerId,
    params: providerParams,
    setupWorktree: runtimeDeps.setupWorkspaceWorktree,
  });

  if (workspace.provider_state !== "ready" || workspace.execution_kind !== "local")
    return workspace as ExtensionWorkspace;

  return (await runtimeDeps.runWorkspaceProvisioning(deps, {
    projectId,
    workspace,
    repoPath: repo!.path,
  })) as ExtensionWorkspace;
};

export const createWorkspacesApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string },
  runtimeDeps: CommandEnvironmentRuntimeDeps,
): CommandRunnerEnvironment["workspaces"] => ({
  list: async () => (await deps.workspaceService.list(input.projectId)) as ExtensionWorkspace[],
  get: async (id) => (await deps.workspaceService.get(id)) as ExtensionWorkspace | null,
  getByShorthand: async (shorthand) =>
    (await deps.workspaceService.getByShorthand(input.projectId, shorthand)) as ExtensionWorkspace | null,
  create: async (workspaceInput) =>
    (await createExtensionWorkspace(
      deps,
      { projectId: input.projectId, workspaceInput },
      runtimeDeps,
    )) as ExtensionWorkspace,
  resolve: async (id) => {
    const workspace = await deps.workspaceService.get(id);
    if (!workspace?.provider_ref_json) throw new Error(`Workspace provider reference not found: ${id}`);
    const providerRef = workspace.provider_ref_json as WorkspaceProviderRef;
    return {
      providerRef,
      state: workspace.provider_state,
      executionKind: workspace.execution_kind,
      executionTarget:
        workspace.execution_kind === "local" && workspace.worktree_path
          ? { kind: "local", rootPath: workspace.worktree_path, displayPath: workspace.display_path ?? undefined }
          : {
              kind: "remote",
              providerId: workspace.provider_id,
              providerRef,
              displayPath: workspace.display_path ?? undefined,
            },
      displayPath: workspace.display_path ?? undefined,
      capabilities: workspace.provider_capabilities_json,
      error: workspace.provider_error_json
        ? {
            code: workspace.provider_error_json.code,
            message: workspace.provider_error_json.message,
            retryable: workspace.provider_error_json.retryable,
          }
        : undefined,
    };
  },
  cancel: async (id) => {
    const workspace = await deps.workspaceService.get(id);
    if (!workspace) throw new Error(`Workspace not found: ${id}`);
    return (await cancelProviderBackedWorkspace(deps, workspace)) as ExtensionWorkspace;
  },
  archive: async (id) => {
    const workspace = await deps.workspaceService.get(id);
    // Cascade archive: also archive the workspace's sessions and remove its worktree.
    if (workspace) return (await archiveWorkspaceCascade(deps, workspace)) as ExtensionWorkspace;
    throw new Error(`Workspace not found: ${id}`);
  },
  delete: async (id) => {
    const workspace = await deps.workspaceService.get(id);
    if (workspace) await deleteProviderBackedWorkspace(deps, workspace);
    await deps.workspaceService.softDelete(id);
  },
});
