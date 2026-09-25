import { basename } from "node:path";
import type { CreateProjectInput, ExtensionSetupWarning } from "pstdio-api-contracts";
import { installRepoDefaultExtensions, resolveDefaultExtensionsConfig } from "../extensions/default-extensions";
import { syncRepoExtensionsForProject } from "../extensions/repo-extensions";
import { runWorkspaceProvisioning } from "../workspaces/provision-coordinator";
import { ensureWorkspaceConfig } from "../workspaces/workspace-config";
import { PROVIDER_READY_TIMEOUT_MS } from "../workspaces/workspace-provider-creation";
import { reconcileProviderWorkspaces } from "../workspaces/workspace-provider-reconciliation";
import {
  canonicalFolder,
  createProviderBackedWorkspace,
  isBuiltInProviderId,
  rootProviderId,
} from "../workspaces/workspace-provider-service";
import type { ProjectsRouteDeps } from "./deps";

const creations = new Map<string, Promise<unknown>>();
export const withFolderCreation = async <T>(path: string | null, create: () => Promise<T>) => {
  if (!path) return create();
  const previous = creations.get(path) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(create);
  creations.set(path, pending);
  try {
    return await pending;
  } finally {
    if (creations.get(path) === pending) creations.delete(path);
  }
};

export const resolveInitialWorkspace = async (input: CreateProjectInput) => {
  const local = input.initial_workspace.provider_id === rootProviderId;
  const path = local ? await canonicalFolder(input.initial_workspace.params.path) : null;
  const name = input.name ?? (path ? basename(path) || "Project" : "Project");
  return {
    path,
    name,
    initial: {
      ...input.initial_workspace,
      params: path ? { ...input.initial_workspace.params, path } : input.initial_workspace.params,
    },
  };
};

const extensionSetupError = async (setup?: () => Promise<ExtensionSetupWarning[]>) => {
  try {
    const warnings = await setup?.();
    return warnings?.map((warning) => `${warning.extension}: ${warning.message}`).join("\n") || null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

type ProjectWorkspace = NonNullable<Awaited<ReturnType<ProjectsRouteDeps["workspaceService"]["getDefault"]>>>;

const initializeLocalProjectWorkspace = async (
  deps: ProjectsRouteDeps,
  projectId: string,
  workspace: ProjectWorkspace,
  rootPath: string,
  setupExtensions?: () => Promise<ExtensionSetupWarning[]>,
) => {
  await deps.workspaceService.setInitializing(workspace.id, true);
  try {
    await ensureWorkspaceConfig(rootPath, rootPath, workspace.id, projectId, deps);
    const setupError = await extensionSetupError(setupExtensions);
    if (setupError) throw new Error(setupError);
    const defaults = await resolveDefaultExtensionsConfig(process.env);
    await installRepoDefaultExtensions({
      defaultExtensions: defaults.defaultExtensions,
      repoPath: rootPath,
    });
    await syncRepoExtensionsForProject({
      extensionService: deps.extensionService,
      installedExtensionSourcesService: deps.installedExtensionSourcesService,
      projectId,
      repoPath: rootPath,
    });
    deps.extensionRuntimeCatalog.invalidate({ projectId, reason: "runtime_refresh" });
    return await runWorkspaceProvisioning(deps, { projectId, workspace, repoPath: rootPath });
  } catch (error) {
    return (
      (await deps.workspaceService.setSetupError(
        workspace.id,
        error instanceof Error ? error.message : String(error),
      )) ?? workspace
    );
  }
};

export const initializeProjectWorkspace = async (
  deps: ProjectsRouteDeps,
  projectId: string,
  initial: CreateProjectInput["initial_workspace"],
  setupExtensions?: () => Promise<ExtensionSetupWarning[]>,
) => {
  let existing = await deps.workspaceService.getDefault(projectId);
  const remoteSetupError = initial.provider_id !== rootProviderId ? await extensionSetupError(setupExtensions) : null;
  const hasProviderOperation =
    existing &&
    !isBuiltInProviderId(existing.provider_id) &&
    (existing.provider_ref_json || existing.provider_operation_id);
  if (existing && hasProviderOperation && !remoteSetupError) {
    await reconcileProviderWorkspaces(deps, projectId, {
      workspaceId: existing.id,
      retryUntilReadyMs: PROVIDER_READY_TIMEOUT_MS,
    });
    existing = await deps.workspaceService.getDefault(projectId);
  }
  const needsFolderRetry = existing?.provider_id === rootProviderId && existing.provider_state !== "ready";
  const workspace =
    existing && (existing.root_path || existing.provider_ref_json || hasProviderOperation) && !needsFolderRetry
      ? existing
      : await createProviderBackedWorkspace(deps, {
          projectId,
          providerId: initial.provider_id,
          params: initial.params,
          isDefault: true,
          name: "Project folder",
        });
  if (remoteSetupError) return (await deps.workspaceService.setSetupError(workspace.id, remoteSetupError)) ?? workspace;
  if (workspace.execution_kind === "remote")
    return (await deps.workspaceService.setSetupError(workspace.id, null)) ?? workspace;
  if (workspace.provider_state !== "ready" || workspace.execution_kind !== "local" || !workspace.root_path)
    return workspace;
  return initializeLocalProjectWorkspace(
    deps,
    projectId,
    workspace,
    workspace.root_path,
    initial.provider_id === rootProviderId ? setupExtensions : undefined,
  );
};
