import type { ExtensionWorkspace, WorkspaceProvisionPayload } from "pstdio-api-contracts/extension-kernel";
import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import { apiLogger } from "../../lib/logger";
import {
  type ExtensionEventDeps,
  fireExtensionEvent,
  fireExtensionEventAsync,
} from "../extensions/extension-event-runtime";
import { ensureWorkspaceConfig } from "./workspace-config";

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

export const runWorkspaceProvisioning = async <
  W extends { id: string; root_path: string | null; execution_kind: string; provider_id: string },
>(
  deps: ProvisionCoordinatorDeps,
  input: { projectId: string; workspace: W; repoPath: string },
  hooks: WorkspaceProvisioningHooks = defaultHooks(),
) => {
  const { projectId, workspace } = input;
  if (workspace.execution_kind !== "local" || !workspace.root_path) return workspace;
  await deps.workspaceService.setInitializing(workspace.id, true);
  try {
    const home = await deps.workspaceService.getDefault(projectId);
    const projectDir = home?.execution_kind === "local" ? (home.root_path ?? undefined) : undefined;
    const payload = {
      projectId,
      workspaceId: workspace.id,
      workspace: workspace as unknown as ExtensionWorkspace,
      workspaceDir: workspace.root_path,
      projectDir,
      providerId: workspace.provider_id,
    } satisfies WorkspaceProvisionPayload;
    await hooks.ensureConfig(workspace.root_path, projectDir ?? workspace.root_path, workspace.id, projectId, deps);
    const outcome = await hooks.fireProvision(deps, projectId, workspaceEvents.provision, payload);
    const failure = outcome.diagnostics?.[0];
    const result = await deps.workspaceService.setSetupError(workspace.id, failure?.message ?? null);
    if (!failure) hooks.fireReadyAsync(deps, projectId, workspaceEvents.ready, payload);
    return (result ?? workspace) as W;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return ((await deps.workspaceService.setSetupError(workspace.id, message)) ?? workspace) as W;
  }
};

const projectQueues = new Map<string, Promise<unknown>>();
/**
 * Runs one project's provisioning and removal in order. Provisioning writes the folder config, so a
 * removal that ran beside a queued pass could see that pass write the config back after it was deleted.
 */
export const inProjectWorkspaceQueue = <T>(projectId: string, task: () => Promise<T>) => {
  const queued = (projectQueues.get(projectId) ?? Promise.resolve()).catch(() => undefined).then(task);
  projectQueues.set(projectId, queued);
  return queued.finally(() => {
    if (projectQueues.get(projectId) === queued) projectQueues.delete(projectId);
  });
};

export const provisionProjectWorkspaces = (
  deps: ProvisionCoordinatorDeps,
  projectId: string,
  hooks: WorkspaceProvisioningHooks = defaultHooks(),
) =>
  inProjectWorkspaceQueue(projectId, async () => {
    for (const workspace of await deps.workspaceService.list(projectId)) {
      if (workspace.provider_state !== "ready" || workspace.execution_kind !== "local" || !workspace.root_path)
        continue;
      await runWorkspaceProvisioning(
        deps,
        { projectId, workspace, repoPath: workspace.root_path },
        { ...hooks, fireReadyAsync: () => {} },
      );
    }
  });
export const scheduleProjectWorkspaceProvisioning = (
  deps: ProvisionCoordinatorDeps,
  projectId: string,
  hooks: WorkspaceProvisioningHooks = defaultHooks(),
) => {
  void provisionProjectWorkspaces(deps, projectId, hooks).catch((err) =>
    apiLogger.warn({ err, project_id: projectId }, "Workspace setup failed"),
  );
};
