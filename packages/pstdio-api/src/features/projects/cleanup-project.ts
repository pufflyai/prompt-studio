import { removeProjectAfterProvisioning } from "../workspaces/provision-coordinator";
import { removeWorkspaceConfig } from "../workspaces/workspace-config";
import { cleanupProviderBackedWorkspace } from "../workspaces/workspace-provider-lifecycle";
import { rootProviderId } from "../workspaces/workspace-provider-service";
import type { ProjectsRouteDeps } from "./deps";
import {
  assertManagedFolderCleanupReady,
  inspectManagedProjectFolder,
  removeManagedProjectFolder,
} from "./managed-project-folder";
import { withFolderCreation } from "./project-folder";

export const cleanupProjectArtifacts = async (
  deps: ProjectsRouteDeps,
  projectId: string,
  options: {
    deleteProviderWorkspace?: typeof cleanupProviderBackedWorkspace;
    removeProjectStorage: (projectId: string) => void | Promise<void>;
  },
) => {
  const projectWorkspaces = await deps.workspaceService.listForProviderReconciliation(projectId);
  const remove = options.deleteProviderWorkspace ?? cleanupProviderBackedWorkspace;

  for (const ws of projectWorkspaces) {
    if (ws.provider_id === rootProviderId) continue;
    const removedWorktree = await remove(deps, ws);
    if (!removedWorktree) {
      throw new Error(`Workspace backing resource could not be removed: ${ws.id}`);
    }
    await deps.workspaceService.softDelete(ws.id);
  }

  await options.removeProjectStorage(projectId);
  const home = projectWorkspaces.find((workspace) => workspace.is_default);
  if (home?.root_path) await removeWorkspaceConfig(home.root_path, projectId, home.id);
};

export const summarizeProjectCopyCleanup = async (
  deps: Pick<ProjectsRouteDeps, "workspaceService">,
  projectId: string,
) => {
  const workspaces = await deps.workspaceService.listForProviderReconciliation(projectId);
  const home = workspaces.find((workspace) => workspace.is_default);
  const providers = workspaces.filter(({ provider_id }) => provider_id !== rootProviderId);
  return {
    ...(await inspectManagedProjectFolder(projectId, home?.root_path)),
    providerWorkspaceCount: providers.length,
    providerWorkspaceNames: providers.map(({ name }) => name),
  };
};

export const evictProjectCopy = (
  deps: ProjectsRouteDeps & Pick<import("../deps").RouteDeps, "assetTransferService">,
  id: string,
) =>
  withFolderCreation(`project-folder:${id}`, async () => {
    const home = await deps.workspaceService.getDefault(id);
    return withFolderCreation(home?.root_path ?? null, () =>
      removeProjectAfterProvisioning(deps, id, async () => {
        await assertManagedFolderCleanupReady(id, home?.root_path);
        await deps.projectService.work.readDuringCleanup(id, () =>
          cleanupProjectArtifacts(deps, id, {
            removeProjectStorage: async () => {
              await deps.fileService.removeProjectStorage(id);
              await deps.fileService.removeOwnedBytes(id);
              await deps.assetTransferService.removeProjectBytes(id);
            },
          }),
        );
        const removeSecrets = await deps.extensionConnectionService.prepareProjectRemoval(id);
        await removeManagedProjectFolder(id, home?.root_path);
        // Delete local rows only after retryable external cleanup succeeds.
        await deps.projectService.delete(id);
        await removeSecrets();
      }),
    );
  });
