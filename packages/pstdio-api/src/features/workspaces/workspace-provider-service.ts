import type {
  JsonObject,
  WorkspaceCapabilities,
  WorkspaceProviderRef,
  WorkspaceProviderResult,
} from "pstdio-api-contracts/extension-kernel";
import { defaultLocalWorkspaceCapabilities } from "pstdio-db";
import type { WorkspacesRouteDeps } from "./deps";
import {
  failedOperationPatch,
  missingProviderPatch,
  operationSettlementPatch,
  providerError,
  resultError,
  type WorkspaceRecord,
} from "./workspace-provider-projection";
import { findWorkspaceProvider, runWorkspaceProviderCall } from "./workspace-provider-runtime";
import { setupWorkspaceWorktree } from "./worktree-setup";

export const rootProviderId = "pstdio.root";
export const worktreeProviderId = "pstdio.worktree";

export const isBuiltInProviderId = (providerId: string) =>
  providerId === rootProviderId || providerId === worktreeProviderId;

export const remoteReadOnlyCapabilities = {
  files: "none",
  diff: false,
  merge: false,
  rebase: false,
  archive: true,
  delete: true,
} satisfies WorkspaceCapabilities;

const asString = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

const secretKeyPattern =
  /^(?:access[_-]?token|auth[_-]?token|api[_-]?key|secret|password|credential|private[_-]?key)$/i;
const MAX_PROVIDER_VALUE_DEPTH = 32;

const inspectProviderValue = (root: unknown) => {
  const seen = new WeakSet<object>();
  const pending = [{ value: root, depth: 0 }];

  while (pending.length > 0) {
    const entry = pending.pop()!;
    if (!entry.value || typeof entry.value !== "object") continue;
    if (entry.depth > MAX_PROVIDER_VALUE_DEPTH || seen.has(entry.value)) return "invalid" as const;
    seen.add(entry.value);

    for (const [key, child] of Object.entries(entry.value)) {
      if (secretKeyPattern.test(key)) return "secret" as const;
      pending.push({ value: child, depth: entry.depth + 1 });
    }
  }

  return null;
};

const safeProviderRef = (providerId: string, data: JsonObject): WorkspaceProviderRef => ({
  version: 1,
  data: { providerId, ...data },
});

export const normalizeResult = (
  providerId: string,
  result: WorkspaceProviderResult,
  options: { providerRef?: WorkspaceProviderRef | null } = {},
) => {
  const inspection = inspectProviderValue(result.providerRef) ?? inspectProviderValue(result.error);
  if (inspection) {
    return {
      provider_state: "failed" as const,
      execution_kind: result.executionKind,
      worktree_path: null,
      provider_error_json: providerError(
        inspection === "secret"
          ? {
              code: "provider_result_contains_secret",
              message: "Provider result contains secret fields.",
              retryable: false,
            }
          : {
              code: "provider_result_invalid",
              message: "Provider result is cyclic or exceeds the supported depth.",
              retryable: false,
            },
      ),
      provider_capabilities_json: remoteReadOnlyCapabilities,
      display_path: null,
      provider_operation_id: null,
      provider_operation_kind: null,
    };
  }

  const target = result.executionTarget;
  const localRoot = target?.kind === "local" ? target.rootPath : null;
  const providerRef = result.providerRef ?? (target?.kind === "remote" ? target.providerRef : options.providerRef);
  return {
    ...(result.branch !== undefined ? { branch: result.branch } : {}),
    ...(providerRef ? { provider_ref_json: providerRef } : {}),
    provider_state: result.state,
    execution_kind: result.executionKind,
    ...(target ? { worktree_path: localRoot } : {}),
    provider_error_json: resultError(result.error),
    provider_capabilities_json: result.capabilities,
    ...((result.displayPath ??
    target?.displayPath ??
    (target?.kind === "remote" ? `${providerId} remote workspace` : localRoot))
      ? {
          display_path:
            result.displayPath ??
            target?.displayPath ??
            (target?.kind === "remote" ? `${providerId} remote workspace` : localRoot),
        }
      : {}),
    ...operationSettlementPatch(result),
  };
};

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

const builtInCreate = async (input: {
  providerId: string;
  projectId: string;
  workspace: WorkspaceRecord;
  params: JsonObject;
  repo: { id: string; path: string };
  setupWorktree: typeof setupWorkspaceWorktree;
}): Promise<WorkspaceProviderResult> => {
  const { repo } = input;

  if (input.providerId === rootProviderId) {
    return {
      providerRef: safeProviderRef(rootProviderId, { repo_id: repo.id }),
      state: "ready",
      executionKind: "local",
      executionTarget: { kind: "local", rootPath: repo.path, displayPath: repo.path },
      displayPath: repo.path,
      capabilities: defaultLocalWorkspaceCapabilities,
    };
  }

  const { branch, worktreePath } = await input.setupWorktree({
    repoPath: repo.path,
    workspaceShorthand: input.workspace.workspace_shorthand,
    base: asString(input.params.base) ?? "HEAD",
  });

  return {
    providerRef: safeProviderRef(worktreeProviderId, { repo_id: repo.id, branch }),
    branch,
    state: "ready",
    executionKind: "local",
    executionTarget: { kind: "local", rootPath: worktreePath, displayPath: worktreePath },
    displayPath: worktreePath,
    capabilities: defaultLocalWorkspaceCapabilities,
  };
};

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

  const updated = await (async () => {
    try {
      const handle = isBuiltInProviderId(providerId)
        ? null
        : await findWorkspaceProvider(deps, {
            projectId: input.projectId,
            providerId,
            workspaceId: workspace.id,
          });
      if (!isBuiltInProviderId(providerId) && !handle) {
        return (
          (await deps.workspaceService.updateProviderProjection(workspace.id, {
            ...missingProviderPatch(workspace),
            execution_kind: "remote",
            provider_capabilities_json: remoteReadOnlyCapabilities,
          })) ?? workspace
        );
      }

      const result = handle
        ? await runWorkspaceProviderCall(() =>
            handle.provider.create(handle.context, {
              operationId,
              projectId: input.projectId,
              workspaceId: workspace.id,
              params,
            }),
          )
        : await builtInCreate({
            providerId,
            projectId: input.projectId,
            workspace,
            params,
            repo: repo!,
            setupWorktree: input.setupWorktree ?? setupWorkspaceWorktree,
          });

      const normalized = normalizeResult(providerId, result);
      return (
        (await deps.workspaceService.updateProviderProjection(workspace.id, {
          ...normalized,
          branch: normalized.branch ?? workspace.branch,
        })) ?? workspace
      );
    } catch (error) {
      return (
        (await deps.workspaceService.updateProviderProjection(workspace.id, {
          ...failedOperationPatch(workspace, {
            kind: "create",
            operationId,
            state: "failed",
            error,
          }),
          execution_kind: isBuiltInProviderId(providerId) ? "local" : "remote",
          provider_capabilities_json: remoteReadOnlyCapabilities,
        })) ?? workspace
      );
    }
  })();

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

export const resolveWorkspaceExecutionTarget = async (
  deps: WorkspacesRouteDeps,
  workspaceId: string,
  access?: "files:read" | "files:write" | "diff",
) => {
  const workspace = await deps.workspaceService.get(workspaceId);
  if (!workspace) return undefined;
  if (workspace.provider_state && workspace.provider_state !== "ready") return undefined;
  if (workspace.setup_error) return undefined;
  if (workspace.execution_kind === "remote") return undefined;
  const capabilities = workspace.provider_capabilities_json;
  if (access === "files:read" && capabilities?.files === "none") return undefined;
  if (access === "files:write" && capabilities && capabilities.files !== "write") return undefined;
  if (access === "diff" && capabilities && !capabilities.diff) return undefined;
  if (workspace.worktree_path) return { workspace, root: workspace.worktree_path };
  if (workspace.provider_id && workspace.provider_id !== rootProviderId && !workspace.is_default) return undefined;

  const [repo] = await deps.repoService.listByProject(workspace.project_id);
  return repo?.path ? { workspace, root: repo.path } : undefined;
};
