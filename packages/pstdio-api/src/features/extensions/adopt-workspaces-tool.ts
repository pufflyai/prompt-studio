import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reconcileProviderWorkspaces } from "../workspaces/workspace-provider-reconciliation";
import { adoptBuiltInGitWorkspaces } from "./built-in-git-workspaces";
import type { ExtensionsRouteDeps } from "./deps";
import { hashExtensionSourceAsync } from "./extension-runtime";
import { combinedWorkspacesSource } from "./workspace-tool-source";

export { combinedWorkspacesSource } from "./workspace-tool-source";

import { withProjectExtensionChoices } from "./project-extension-choices";
import { openPublishedCatalog, publishExtension, publishedOwner } from "./publication/catalog";
import { preparePublishedExtension } from "./publication/prepare";
import { selectPublicationSource } from "./publication/prepare-activation";

type ExtensionRecords = Awaited<ReturnType<ExtensionsRouteDeps["extensionService"]["listProjectExtensionInstances"]>>;

const prepareSuccessor = async (deps: ExtensionsRouteDeps, projectId: string, records: ExtensionRecords) => {
  // Alias lookup can return another private copy of the same extension. Only the
  // explicitly named installation is the default source we may publish here.
  const candidate = await deps.extensionService.getInstalledSource("pstdio.workspaces");
  const source =
    records.find(
      ({ installedSource }) =>
        installedSource.extension_id === "pstdio.workspaces" && installedSource.install_name === "workspaces",
    )?.installedSource ?? (candidate?.install_name === "workspaces" ? candidate : undefined);
  const preferred = selectPublicationSource(
    records.filter(({ installedSource }) => installedSource.extension_id === "pstdio.workspaces"),
  );
  const preferredReady = preferred && (await combinedWorkspacesSource(preferred.installedSource.source_path));
  const defaultReady =
    source?.extension_id === "pstdio.workspaces" && (await combinedWorkspacesSource(source.source_path));
  if (!preferredReady && !defaultReady) return null;
  const successor = preferredReady
    ? preferred
    : await deps.extensionService.attachRegisteredSourceForProject({
        projectId,
        installedSourceId: source!.id,
      });
  if (!successor) return null;
  return {
    successor,
    source,
    defaultReady,
    privateSuccessor: preferredReady && preferred.installedSource.id !== source?.id,
  };
};

const requireActiveSuccessor = async (deps: ExtensionsRouteDeps, projectId: string, legacy: ExtensionRecords) => {
  const runtime = await deps.extensionRuntimeCatalog.get(projectId);
  if (
    legacy.some(({ instance }) => instance.enabled) &&
    !runtime.runtime.workspaceTypes.some(({ id }) => id === "pstdio.workspaces.workspace-type.git")
  )
    throw new Error("The combined Workspaces provider must be active before retiring Git Workspaces.");
};

/** One combined tool inherits enablement from either predecessor. Source files and data remain on disk. */
const sharedProviderReady = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  previous: Awaited<ReturnType<Awaited<ReturnType<typeof openPublishedCatalog>>["read"]>>,
) => {
  if (!previous.value || !previous.asset) return false;
  try {
    const bytes = await new Response(
      await deps.assetTransferService.read(publishedOwner(projectId), previous.asset),
    ).blob();
    const prepared = await preparePublishedExtension({
      bytes,
      root: join(tmpdir(), "pstdio-workspaces-upgrade"),
      extensionId: "pstdio.workspaces",
    });
    try {
      return await combinedWorkspacesSource(prepared.path);
    } finally {
      await rm(prepared.path, { recursive: true, force: true });
    }
  } catch {
    // A missing or invalid package is no proof that the shared provider can be retired.
    return false;
  }
};

export type FreshWorkspaceSource = { path: string; hash: string };

const findFreshSource = async (fresh: FreshWorkspaceSource[], path: string) => {
  const source = fresh.find((entry) => entry.path === path);
  return source && (await hashExtensionSourceAsync(source.path)) === source.hash ? source : null;
};

export const adoptWorkspacesTool = (deps: ExtensionsRouteDeps, projectId: string, fresh: FreshWorkspaceSource[] = []) =>
  withProjectExtensionChoices(deps.extensionService, projectId, () => adopt(deps, projectId, fresh));

const canRetireSharedProvider = (deps: ExtensionsRouteDeps, projectId: string, published: boolean) =>
  published ? deps.accountService.canPublishProjectExtensions(projectId) : Promise.resolve(true);

const adopt = async (deps: ExtensionsRouteDeps, projectId: string, fresh: FreshWorkspaceSource[]) => {
  const records = await deps.extensionService.listProjectExtensionInstances(projectId);
  const legacy = records.filter(({ installedSource }) => installedSource.extension_id === "pstdio.git-workspaces");
  if (!legacy.length) return adoptBuiltInGitWorkspaces(deps, projectId, records);
  const token = (items: typeof records, owner: string) =>
    JSON.stringify(
      items
        .filter(({ installedSource }) => installedSource.extension_id === owner)
        .map(({ instance, installedSource }) => [
          instance.id,
          instance.enabled,
          instance.updated_at,
          installedSource.source_path,
        ])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    );
  const legacyToken = token(records, "pstdio.git-workspaces");
  const catalog = await openPublishedCatalog(deps, projectId);
  const oldSelection = await catalog.read("pstdio.git-workspaces");
  if (!(await canRetireSharedProvider(deps, projectId, Boolean(oldSelection.value)))) return;
  const previous = await catalog.read("pstdio.workspaces");
  const prepared = await prepareSuccessor(deps, projectId, records);
  if (!prepared) return;
  const { successor, source, defaultReady, privateSuccessor } = prepared;
  const enabled = successor.instance.enabled || legacy.some(({ instance }) => instance.enabled);
  if (enabled && !successor.instance.enabled)
    await deps.extensionService.setProjectExtensionEnabled(successor.instance.id, true);
  await requireActiveSuccessor(deps, projectId, legacy);
  let publicationSource = successor;
  if (oldSelection.value && privateSuccessor && !previous.value) {
    if (!defaultReady) return;
    publicationSource =
      (await deps.extensionService.attachRegisteredSourceForProject({ projectId, installedSourceId: source!.id })) ??
      successor;
  }
  const expectedSuccessor = token(
    await deps.extensionService.listProjectExtensionInstances(projectId),
    "pstdio.workspaces",
  );
  const beforeCommit = async () => {
    const current = await deps.extensionService.listProjectExtensionInstances(projectId);
    if (
      token(current, "pstdio.git-workspaces") !== legacyToken ||
      token(current, "pstdio.workspaces") !== expectedSuccessor
    )
      throw new Error("Workspace tool choices changed during consolidation. Try again.");
  };
  if (oldSelection.value) {
    const replacement = {
      extensionId: "pstdio.git-workspaces",
      expectedRevision: oldSelection.revision,
      enabled,
      beforeCommit,
    };
    const accepted = await findFreshSource(fresh, publicationSource.installedSource.source_path);
    if (accepted) {
      const checkChoices = replacement.beforeCommit;
      replacement.beforeCommit = async () => {
        await checkChoices();
        if ((await hashExtensionSourceAsync(accepted.path)) !== accepted.hash)
          throw new Error("Workspaces source changed during consolidation. Try again.");
      };
      await publishExtension(deps, {
        projectId,
        instanceId: publicationSource.instance.id,
        expectedRevision: previous.revision,
        replacement,
      });
    } else if (previous.value && previous.asset && (await sharedProviderReady(deps, projectId, previous))) {
      await catalog.select({ ...previous.value, enabled }, previous.asset, previous.revision, replacement);
    } else return;
  } else {
    await beforeCommit();
  }
  await reconcileProviderWorkspaces(deps, projectId);
  await beforeCommit();
  for (const { instance } of legacy) await deps.extensionService.removeProjectExtensionInstance(instance.id);
};
