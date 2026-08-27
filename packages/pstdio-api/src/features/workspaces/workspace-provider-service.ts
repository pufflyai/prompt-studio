import type { JsonObject } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import { provisionProviderWorkspace } from "./workspace-provider-creation";
import {
  isBuiltInProviderId,
  remoteReadOnlyCapabilities,
  rootProviderId,
  worktreeProviderId,
} from "./workspace-provider-identity";
import type { WorkspaceRecord } from "./workspace-provider-projection";
import { setupWorkspaceWorktree } from "./worktree-setup";

export { resolveWorkspaceExecutionTarget } from "./workspace-provider-execution-target";
export { normalizeResult } from "./workspace-provider-result";
export { isBuiltInProviderId, remoteReadOnlyCapabilities, rootProviderId, worktreeProviderId };

const asString = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

const resolveRepo = async (deps: WorkspacesRouteDeps, projectId: string, repoId?: string) => {
  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length === 0) return null;
  if (repoId) return repos.find((repo) => repo.id === repoId) ?? null;
  return repos[0] ?? null;
};

export class WorkspaceRepoNotFoundError extends Error {}

export const mergeProviderParams = (input: { params?: JsonObject; repoId?: string; base?: string }) => ({
  ...(input.params ?? {}),
  ...(input.repoId ? { repo_id: input.repoId } : {}),
  ...(input.base ? { base: input.base } : {}),
});

export const createProviderBackedWorkspace = async (
  deps: WorkspacesRouteDeps,
  input: {
    projectId: string;
    shorthandBase?: string;
    name?: string;
    anchors?: WorkspaceRecord["anchors_json"];
    providerId?: string;
    params?: JsonObject;
    repoId?: string;
    base?: string;
    standalone?: boolean;
    setupWorktree?: typeof setupWorkspaceWorktree;
    provision?: (workspace: WorkspaceRecord, repoPath: string) => Promise<WorkspaceRecord>;
    signal?: AbortSignal;
  },
) => {
  const providerId = input.providerId ?? worktreeProviderId;
  const params = mergeProviderParams(input);
  const repo = isBuiltInProviderId(providerId)
    ? await resolveRepo(deps, input.projectId, asString(params.repo_id))
    : null;
  if (isBuiltInProviderId(providerId) && !repo) {
    throw new WorkspaceRepoNotFoundError(`No repository found for project ${input.projectId}`);
  }
  const operationId = crypto.randomUUID();
  const createInput = {
    project_id: input.projectId,
    name: input.name,
    provider_id: providerId,
    provider_params_json: params,
    provider_state: "provisioning" as const,
    provider_operation_id: operationId,
    provider_operation_kind: "create" as const,
  };
  const workspace =
    input.standalone === true
      ? await deps.workspaceService.createStandalone(createInput)
      : await deps.workspaceService.create({
          ...createInput,
          shorthand_base: input.shorthandBase ?? "",
          anchors: input.anchors,
        });

  const updated = await provisionProviderWorkspace(deps, {
    operationId,
    projectId: input.projectId,
    providerId,
    params,
    repo,
    setupWorktree: input.setupWorktree ?? setupWorkspaceWorktree,
    signal: input.signal,
    workspace,
  });

  const provisioningRepoPath = repo?.path ?? updated.worktree_path;
  if (
    input.provision &&
    updated.provider_state === "ready" &&
    updated.execution_kind === "local" &&
    updated.worktree_path &&
    provisioningRepoPath
  ) {
    return input.provision(updated, provisioningRepoPath);
  }
  return updated;
};
