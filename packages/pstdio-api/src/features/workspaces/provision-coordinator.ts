import type { ExtensionWorkspace, WorkspaceProvisionPayload } from "pstdio-api-contracts/extension-kernel";
import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import { apiLogger } from "../../lib/logger";
import {
  type ExtensionEventDeps,
  fireExtensionEvent,
  fireExtensionEventAsync,
} from "../extensions/extension-event-runtime";
import { ensureWorkspaceConfig } from "./workspace-config";
import { hasPendingRestoredFolderSetup } from "./workspace-provider-identity";

export type ProvisionCoordinatorDeps = ExtensionEventDeps;
export type WorkspaceProvisioningHooks = {
  fireProvision: typeof fireExtensionEvent;
  fireReadyAsync: typeof fireExtensionEventAsync;
  ensureConfig: typeof ensureWorkspaceConfig;
};
const defaultHooks = (): WorkspaceProvisioningHooks => ({
  fireProvision: fireExtensionEvent,
  fireReadyAsync: fireExtensionEventAsync,
  ensureConfig: ensureWorkspaceConfig,
});

type ProvisionWorkspace = { id: string; root_path: string | null; execution_kind: string; provider_id: string };
type ProvisionInput<W extends ProvisionWorkspace> = { projectId: string; workspace: W; repoPath: string };
const isReadyLocalWorkspace = (workspace: ProvisionWorkspace & { provider_state: string }) =>
  workspace.provider_state === "ready" && workspace.execution_kind === "local" && Boolean(workspace.root_path);

const provisionWorkspaceFiles = async <W extends ProvisionWorkspace>(
  deps: ProvisionCoordinatorDeps,
  input: ProvisionInput<W>,
  hooks: WorkspaceProvisioningHooks,
) => {
  const { projectId, workspace } = input;
  const home = await deps.workspaceService.getDefault(projectId);
  const projectDir = home?.execution_kind === "local" ? (home.root_path ?? undefined) : undefined;
  const payload = {
    projectId,
    workspaceId: workspace.id,
    workspace: workspace as unknown as ExtensionWorkspace,
    workspaceDir: workspace.root_path!,
    projectDir,
    providerId: workspace.provider_id,
  } satisfies WorkspaceProvisionPayload;
  await hooks.ensureConfig(workspace.root_path!, projectDir ?? workspace.root_path!, workspace.id, projectId, deps);
  const outcome = await hooks.fireProvision(deps, projectId, workspaceEvents.provision, payload);
  return { payload, error: outcome.diagnostics?.[0]?.message ?? null };
};

// Creation still publishes its real lifecycle transitions. The same gate serializes it with any
// catalog maintenance that arrives while a provider is finishing the workspace.
export const runWorkspaceProvisioning = async <W extends ProvisionWorkspace>(
  deps: ProvisionCoordinatorDeps,
  input: ProvisionInput<W>,
  hooks: WorkspaceProvisioningHooks = defaultHooks(),
) => {
  const { projectId, workspace } = input;
  if (workspace.execution_kind !== "local" || !workspace.root_path) return workspace;
  return deps.workspaceService.maintenance.run(workspace.id, async () => {
    await deps.workspaceService.setInitializing(workspace.id, true);
    try {
      const { payload, error } = await provisionWorkspaceFiles(deps, input, hooks);
      const result = await deps.workspaceService.setSetupError(workspace.id, error);
      if (!error) hooks.fireReadyAsync(deps, projectId, workspaceEvents.ready, payload);
      return (result ?? workspace) as W;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ((await deps.workspaceService.setSetupError(workspace.id, message)) ?? workspace) as W;
    }
  });
};

const maintainWorkspace = (
  deps: ProvisionCoordinatorDeps,
  projectId: string,
  id: string,
  hooks: WorkspaceProvisioningHooks,
) =>
  deps.workspaceService.maintenance.run(id, async () => {
    const workspace = await deps.workspaceService.get(id);
    if (
      !workspace ||
      workspace.project_id !== projectId ||
      hasPendingRestoredFolderSetup(workspace) ||
      workspace.provider_state !== "ready" ||
      workspace.execution_kind !== "local" ||
      !workspace.root_path
    )
      return;
    let message: string | null;
    try {
      ({ error: message } = await provisionWorkspaceFiles(
        deps,
        { projectId, workspace, repoPath: workspace.root_path },
        hooks,
      ));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    // A healthy ready workspace never left its lifecycle state. Publish actual failures and
    // recoveries, while keeping the transient file-copy gate private to session admission.
    if (workspace.setup_error !== message || workspace.initializing)
      await deps.workspaceService.setSetupError(id, message);
  });

interface ProjectProvisionQueue {
  interrupted: boolean;
  revision: number;
  deps: ProvisionCoordinatorDeps;
  hooks: WorkspaceProvisioningHooks;
  requests: { revision: number; resolve: () => void; reject: (error: unknown) => void }[];
}
const projectProvisionQueues = new WeakMap<
  ProvisionCoordinatorDeps["workspaceService"],
  Map<string, ProjectProvisionQueue>
>();
const projectQueues = new WeakMap<ProvisionCoordinatorDeps["workspaceService"], Map<string, Promise<unknown>>>();
const hostMap = <T>(
  owners: WeakMap<ProvisionCoordinatorDeps["workspaceService"], Map<string, T>>,
  deps: ProvisionCoordinatorDeps,
) => {
  let projects = owners.get(deps.workspaceService);
  if (!projects) {
    projects = new Map();
    owners.set(deps.workspaceService, projects);
  }
  return projects;
};
// Provisioning and removal share one per-host/project queue; independent hosts never block each other.
export const inProjectWorkspaceQueue = <T>(
  deps: ProvisionCoordinatorDeps,
  projectId: string,
  task: () => Promise<T>,
) => {
  const projects = hostMap(projectQueues, deps);
  const queued = (projects.get(projectId) ?? Promise.resolve()).catch(() => undefined).then(task);
  projects.set(projectId, queued);
  return queued.finally(() => {
    if (projects.get(projectId) === queued) projects.delete(projectId);
  });
};
export const removeProjectAfterProvisioning = async <T>(
  deps: ProvisionCoordinatorDeps,
  projectId: string,
  task: () => Promise<T>,
) => {
  const projects = hostMap(projectProvisionQueues, deps);
  const interrupted = projects.get(projectId);
  if (interrupted) {
    interrupted.interrupted = true;
    // Requests arriving after removal must queue behind it, even while the last file copy finishes.
    projects.delete(projectId);
  }
  try {
    return await inProjectWorkspaceQueue(deps, projectId, task);
  } catch (error) {
    if (interrupted && !projects.has(projectId))
      await provisionProjectWorkspaces(interrupted.deps, projectId, interrupted.hooks);
    throw error;
  }
};

const settleRefreshes = (queue: ProjectProvisionQueue, revision: number) => {
  let completed = 0;
  while (completed < queue.requests.length && queue.requests[completed]!.revision <= revision) {
    queue.requests[completed++]!.resolve();
  }
  if (completed) queue.requests.splice(0, completed);
};

const maintainProjectRevision = async (
  queue: ProjectProvisionQueue,
  projectId: string,
  applied: Map<string, number>,
) => {
  const pass = queue.revision;
  const workspaces = (await queue.deps.workspaceService.list(projectId)).filter(isReadyLocalWorkspace);
  // Each visited workspace receives at least this pass. The suffix minimum tells us which
  // revisions the remaining workspaces already have, without rescanning the list after each copy.
  const remainingRevision: number[] = [];
  remainingRevision[workspaces.length] = pass;
  for (let index = workspaces.length - 1; index >= 0; index--) {
    remainingRevision[index] = Math.min(remainingRevision[index + 1]!, applied.get(workspaces[index]!.id) ?? 0);
  }
  for (const [index, workspace] of workspaces.entries()) {
    if (queue.interrupted) break;
    if ((applied.get(workspace.id) ?? 0) < queue.revision) {
      const revision = queue.revision;
      await maintainWorkspace(queue.deps, projectId, workspace.id, queue.hooks);
      applied.set(workspace.id, revision);
    }
    settleRefreshes(queue, remainingRevision[index + 1]!);
  }
  settleRefreshes(queue, queue.interrupted ? Infinity : pass);
};

export const provisionProjectWorkspaces = (
  deps: ProvisionCoordinatorDeps,
  projectId: string,
  hooks: WorkspaceProvisioningHooks = defaultHooks(),
  options: { skipWorkspaceId?: string } = {},
) => {
  const projects = hostMap(projectProvisionQueues, deps);
  const current = projects.get(projectId);
  const completion = Promise.withResolvers<void>();
  if (current) {
    current.revision++;
    current.deps = deps;
    current.hooks = hooks;
    current.requests.push({ revision: current.revision, resolve: completion.resolve, reject: completion.reject });
    return completion.promise;
  }
  const queue: ProjectProvisionQueue = {
    interrupted: false,
    revision: 1,
    deps,
    hooks,
    requests: [{ revision: 1, resolve: completion.resolve, reject: completion.reject }],
  };
  projects.set(projectId, queue);
  void inProjectWorkspaceQueue(deps, projectId, async () => {
    const applied = new Map<string, number>();
    // Startup has already provisioned this workspace for the first request. A later refresh still visits it.
    if (options.skipWorkspaceId) applied.set(options.skipWorkspaceId, 1);
    try {
      while (queue.requests.length) await maintainProjectRevision(queue, projectId, applied);
    } catch (error) {
      for (const request of queue.requests) request.reject(error);
    } finally {
      if (projects.get(projectId) === queue) projects.delete(projectId);
    }
  });
  return completion.promise;
};

export const scheduleProjectWorkspaceProvisioning = (
  deps: ProvisionCoordinatorDeps,
  projectId: string,
  hooks: WorkspaceProvisioningHooks = defaultHooks(),
) => {
  void provisionProjectWorkspaces(deps, projectId, hooks).catch((err) =>
    apiLogger.warn({ err, project_id: projectId }, "Workspace setup failed"),
  );
};
