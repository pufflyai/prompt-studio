import { catalogProviderId, worktreeProviderId } from "../workspaces/workspace-provider-identity";
import { reconcileProviderWorkspaces } from "../workspaces/workspace-provider-reconciliation";
import type { ExtensionsRouteDeps } from "./deps";
import { openPublishedCatalog } from "./publication/catalog";
import { combinedWorkspacesSource } from "./workspace-tool-source";

type Records = Awaited<ReturnType<ExtensionsRouteDeps["extensionService"]["listProjectExtensionInstances"]>>;

/** Built-in Git had no extension instance. Recover that capability without undoing a later tool choice. */
export const needsBuiltInGitRecovery = async (deps: ExtensionsRouteDeps, projectId: string, records: Records) => {
  const rows = await deps.workspaceService.listForProviderReconciliation(projectId);
  if (!rows.some(({ provider_id }) => catalogProviderId(provider_id) === worktreeProviderId)) return false;
  const shared = await (await openPublishedCatalog(deps, projectId)).read("pstdio.workspaces");
  if (shared.exists && (shared.deleted || shared.value?.enabled === false)) return false;
  const copies = records.filter(({ installedSource }) => installedSource.extension_id === "pstdio.workspaces");
  if (copies.some(({ instance }) => instance.enabled)) return true;
  if (shared.exists) return false;
  return !(await deps.extensionService.hasDefaultSourceChoice(projectId, "pstdio.workspaces"));
};

export const adoptBuiltInGitWorkspaces = async (deps: ExtensionsRouteDeps, projectId: string, records: Records) => {
  if (!(await needsBuiltInGitRecovery(deps, projectId, records))) return;
  const selected = records.find(
    ({ instance, installedSource }) => instance.enabled && installedSource.extension_id === "pstdio.workspaces",
  );
  if (selected) {
    if (await combinedWorkspacesSource(selected.installedSource.source_path).catch(() => false))
      await reconcileProviderWorkspaces(deps, projectId);
    return;
  }
  const source = await deps.extensionService.getInstalledSource("workspaces");
  if (
    !source ||
    source.extension_id !== "pstdio.workspaces" ||
    source.install_name !== "workspaces" ||
    !(await combinedWorkspacesSource(source.source_path).catch(() => false))
  )
    return;
  const adopted = await deps.extensionService.adoptDefaultSourceForProject(projectId, source.id);
  if (adopted) await reconcileProviderWorkspaces(deps, projectId);
};
