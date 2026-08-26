import type {
  JsonObject,
  WorkspaceCapabilities,
  WorkspaceProviderRef,
  WorkspaceProviderResult,
  WorkspaceTypeProvider,
} from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import { setupWorkspaceWorktree } from "./worktree-setup";

type WorkspaceRecord = NonNullable<Awaited<ReturnType<WorkspacesRouteDeps["workspaceService"]["get"]>>>;

export const rootProviderId = "pstdio.root";
export const worktreeProviderId = "pstdio.worktree";

export const isBuiltInProviderId = (providerId: string) =>
  providerId === rootProviderId || providerId === worktreeProviderId;

export const localWorkspaceCapabilities: WorkspaceCapabilities = {
  files: "write",
  diff: true,
  merge: true,
  rebase: true,
  archive: true,
  delete: true,
};

export const remoteReadOnlyCapabilities: WorkspaceCapabilities = {
  files: "none",
  diff: false,
  merge: false,
  rebase: false,
  archive: true,
  delete: true,
};

const asString = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

const containsSecretLikeKey = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;

  for (const [key, child] of Object.entries(value)) {
    if (/token|secret|password|credential|private[_-]?key/i.test(key)) return true;
    if (containsSecretLikeKey(child)) return true;
  }

  return false;
};

const safeProviderRef = (providerId: string, data: JsonObject): WorkspaceProviderRef => ({
  version: 1,
  data: { providerId, ...data },
});

const providerError = (error: WorkspaceProviderResult["error"]) =>
  error
    ? {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        occurred_at: new Date().toISOString(),
      }
    : null;

export const normalizeResult = (providerId: string, result: WorkspaceProviderResult) => {
  if (containsSecretLikeKey(result.providerRef) || containsSecretLikeKey(result.error)) {
    return {
      provider_ref_json: null,
      provider_state: "failed" as const,
      execution_kind: result.executionKind,
      worktree_path: null,
      provider_error_json: {
        code: "provider_result_contains_secret",
        message: "Provider result contains secret-like fields.",
        retryable: false,
        occurred_at: new Date().toISOString(),
      },
      provider_capabilities_json: remoteReadOnlyCapabilities,
      display_path: null,
    };
  }

  const target = result.executionTarget;
  const localRoot = target?.kind === "local" ? target.rootPath : null;
  const branch = typeof result.providerRef?.data.branch === "string" ? result.providerRef.data.branch : undefined;
  return {
    branch,
    provider_ref_json: result.providerRef ?? (target?.kind === "remote" ? target.providerRef : null),
    provider_state: result.state,
    execution_kind: result.executionKind,
    worktree_path: localRoot,
    provider_error_json: providerError(result.error),
    provider_capabilities_json: result.capabilities,
    display_path:
      result.displayPath ??
      target?.displayPath ??
      (target?.kind === "remote" ? `${providerId} remote workspace` : localRoot),
  };
};

const resolveRepo = async (deps: WorkspacesRouteDeps, projectId: string, repoId?: string) => {
  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length === 0) return null;
  if (repoId) return repos.find((repo) => repo.id === repoId) ?? null;
  return repos[0] ?? null;
};

const builtInCreate = async (
  deps: WorkspacesRouteDeps,
  input: {
    providerId: string;
    projectId: string;
    workspace: WorkspaceRecord;
    params: JsonObject;
    setupWorktree: typeof setupWorkspaceWorktree;
  },
): Promise<WorkspaceProviderResult> => {
  const repoId = asString(input.params.repo_id);
  const repo = await resolveRepo(deps, input.projectId, repoId);
  if (!repo) {
    throw new Error(`No repository found for project ${input.projectId}`);
  }

  if (input.providerId === rootProviderId) {
    return {
      providerRef: safeProviderRef(rootProviderId, { repo_id: repo.id }),
      state: "ready",
      executionKind: "local",
      executionTarget: { kind: "local", rootPath: repo.path, displayPath: repo.path },
      displayPath: repo.path,
      capabilities: localWorkspaceCapabilities,
    };
  }

  const { branch, worktreePath } = await input.setupWorktree({
    repoPath: repo.path,
    workspaceShorthand: input.workspace.workspace_shorthand,
    base: asString(input.params.base) ?? "HEAD",
  });

  return {
    providerRef: safeProviderRef(worktreeProviderId, { repo_id: repo.id, branch }),
    state: "ready",
    executionKind: "local",
    executionTarget: { kind: "local", rootPath: worktreePath, displayPath: worktreePath },
    displayPath: worktreePath,
    capabilities: localWorkspaceCapabilities,
  };
};

export const findExtensionProvider = async (deps: WorkspacesRouteDeps, projectId: string, providerId: string) => {
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  const record = snapshot.runtime.workspaceTypes.find((candidate) => candidate.id === providerId);
  return record?.provider as WorkspaceTypeProvider | undefined;
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
    standalone?: boolean;
    setupWorktree?: typeof setupWorkspaceWorktree;
  },
) => {
  const providerId = input.providerId ?? worktreeProviderId;
  const params = input.params ?? {};
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

  try {
    const provider = isBuiltInProviderId(providerId)
      ? null
      : await findExtensionProvider(deps, input.projectId, providerId);
    if (!isBuiltInProviderId(providerId) && !provider) {
      return (
        (await deps.workspaceService.updateProviderProjection(workspace.id, {
          provider_state: "provider_missing",
          execution_kind: "remote",
          worktree_path: null,
          provider_ref_json: null,
          provider_error_json: {
            code: "provider_unavailable",
            message: `Workspace provider is not available: ${providerId}`,
            retryable: true,
            occurred_at: new Date().toISOString(),
          },
          provider_capabilities_json: remoteReadOnlyCapabilities,
          display_path: null,
        })) ?? workspace
      );
    }

    const result = provider
      ? await provider.create({} as never, {
          operationId,
          projectId: input.projectId,
          workspaceId: workspace.id,
          params,
        })
      : await builtInCreate(deps, {
          providerId,
          projectId: input.projectId,
          workspace,
          params,
          setupWorktree: input.setupWorktree ?? setupWorkspaceWorktree,
        });

    const normalized = normalizeResult(providerId, result);
    return (
      (await deps.workspaceService.updateProviderProjection(workspace.id, {
        branch: normalized.branch ?? workspace.branch,
        ...normalized,
      })) ?? workspace
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      (await deps.workspaceService.updateProviderProjection(workspace.id, {
        provider_state: "failed",
        execution_kind: isBuiltInProviderId(providerId) ? "local" : "remote",
        worktree_path: null,
        provider_ref_json: null,
        provider_error_json: {
          code: "provider_create_failed",
          message,
          retryable: true,
          occurred_at: new Date().toISOString(),
        },
        provider_capabilities_json: remoteReadOnlyCapabilities,
        display_path: null,
      })) ?? workspace
    );
  }
};

export const resolveWorkspaceExecutionTarget = async (deps: WorkspacesRouteDeps, workspaceId: string) => {
  const workspace = await deps.workspaceService.get(workspaceId);
  if (!workspace) return undefined;
  if (workspace.provider_state && workspace.provider_state !== "ready") return undefined;
  if (workspace.execution_kind === "remote") return undefined;
  if (workspace.worktree_path) return { workspace, root: workspace.worktree_path };
  if (workspace.provider_id && workspace.provider_id !== rootProviderId && !workspace.is_default) return undefined;

  const [repo] = await deps.repoService.listByProject(workspace.project_id);
  return repo?.path ? { workspace, root: repo.path } : undefined;
};
