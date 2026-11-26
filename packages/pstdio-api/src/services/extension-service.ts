import {
  attachUnlessRemoved,
  createExtensionSourceReaders,
  type EnableInstalledSourceInput,
  type ExtensionServiceDeps,
  ProjectNotFoundError,
  projectOfInstance,
  type RegisterInstalledSourceInput,
  type SyncInstalledSourceInput,
} from "./extension-service-support";

export type {
  EnableInstalledSourceInput,
  RegisterInstalledSourceInput,
  SourceKind,
  SyncInstalledSourceInput,
} from "./extension-service-support";
export { ExtensionNameConflictError, ProjectNotFoundError } from "./extension-service-support";

import { existsSync } from "node:fs";
import { dirname, relative } from "node:path";
import { pstdioExtensionsRoot, withRequestedPreparation } from "pstdio-extensions";
import { isAlwaysEnabledExtensionSource } from "../features/extensions/always-on-extensions";
import { settlePreparedInstall } from "../features/extensions/extension-install-transaction";
import type { LoadedExtensionSnapshot } from "../features/extensions/extension-runtime";
import { activatePublishedExtensions } from "./activate-published-extension";
import { createExtensionChoicePolicy } from "./extension-choice-policy";
import { serializeExtensionChoices } from "./extension-choice-service";
import { assertExpectedExtensionProvider, createExtensionEnablement } from "./extension-enablement";
import {
  type PruneProjectExtensionInstancesInput,
  pruneProjectExtensionInstances as pruneProjectExtensionInstancesImpl,
  removeUnusedFolderSources,
} from "./extension-prune";
import {
  createWebviewBuildReports,
  reloadInstalledSourceBySourcePath as reloadInstalledSourceBySourcePathImpl,
} from "./extension-reload";
import { createExtensionSourceMutations, createExtensionSourceRefresh } from "./extension-source-mutations";
import { createInstalledSourceRegistrar } from "./extension-source-registration";
import { uninstallProjectExtension as uninstallProjectExtensionImpl } from "./extension-uninstall";

export type { PruneProjectExtensionInstancesInput } from "./extension-prune";

export const createExtensionService = (deps: ExtensionServiceDeps) => {
  const { listEnabledSourcesForProject, hasEnabledProjectSource, listProjectInstances, getProjectExtensionInstance } =
    createExtensionSourceReaders(deps);
  const { assertProjectChoice, assertInstalledSourceChoice } = createExtensionChoicePolicy(deps);
  const mutateSource = createExtensionSourceMutations();
  const emitInstalledSource = (source: unknown) => {
    deps.eventBus?.emit("installed_extension_sources", "set", source);
  };

  const emitExtensionInstance = (instance: unknown) => {
    deps.eventBus?.emit("extension_instances", "set", instance);
  };

  const { adoptDefaultSourceForProject, assertOptional, claimExtensionId, setProjectExtensionEnabled } =
    createExtensionEnablement({
      ...deps,
      assertProjectChoice,
      emitExtensionInstance,
      onDefaultAdopted: (sourcePath) => withRequestedPreparation(() => notifyInstalledSourcesChanged(sourcePath)),
    });

  const notifyInstalledSourcesChanged = async (sourcePath?: string, validatedSource?: LoadedExtensionSnapshot) => {
    await deps.onInstalledSourcesChanged?.(sourcePath, validatedSource);
  };

  const reloadDeps = {
    authorizeChange: assertInstalledSourceChoice,
    installedExtensionSourcesService: deps.installedExtensionSourcesService,
    emitInstalledSource,
    notifyInstalledSourcesChanged,
    hashExtension: deps.hashExtension,
    checkExtension: deps.checkExtension,
  };

  const registerSource = createInstalledSourceRegistrar({
    sources: deps.installedExtensionSourcesService,
    emitInstalledSource,
    authorizeChange: assertInstalledSourceChoice,
  });
  // Publishing a prepared tool includes its live notification/imports. Keep that
  // adoption from inheriting startup priority and being repeatedly retired by readers.
  const registerInstalledSource = (input: RegisterInstalledSourceInput) =>
    withRequestedPreparation(async () => (await registerSource(input, notifyInstalledSourcesChanged)).installedSource);

  const getInstalledSource = (installName: string) =>
    deps.installedExtensionSourcesService.getByInstallName(installName);

  const findProjectInstanceForSource = async (
    input: Pick<EnableInstalledSourceInput, "projectId">,
    installedSource: Awaited<ReturnType<typeof registerInstalledSource>>,
  ) => {
    return deps.extensionInstancesService.findByScopeInstalledSource("project", input.projectId, installedSource.id);
  };

  // Discovery must never adopt. A folder that changed on disk is an offer the user takes from the
  // extension panel; until then the project keeps running the source it already accepted.
  const attachInstalledSource = async (
    input: RegisterInstalledSourceInput,
    notify: Parameters<typeof registerSource>[1],
  ) => {
    const existing = await deps.installedExtensionSourcesService.getBySourcePath(input.sourcePath);
    if (existing && input.sourceHash && existing.source_hash && input.sourceHash !== existing.source_hash) {
      return { installedSource: existing, created: false };
    }

    return registerSource(input, notify);
  };

  const assertProjectExists = async (projectId: string) => {
    if (!(await deps.projectService.get(projectId))) throw new ProjectNotFoundError(projectId);
  };

  const createProjectInstance = async (
    input: Pick<EnableInstalledSourceInput, "projectId">,
    installedSource: Awaited<ReturnType<typeof registerInstalledSource>>,
  ) => {
    try {
      return await deps.extensionInstancesService.create({
        installed_extension_id: installedSource.id,
        scope_id: input.projectId,
        scope_type: "project",
        enabled: false,
      });
    } catch (error) {
      const raced = await findProjectInstanceForSource(input, installedSource);
      if (!raced) throw error;
      return raced;
    }
  };

  const enableInstalledSourceForProject = async (
    input: EnableInstalledSourceInput,
    options: { expectedProvider?: string } = {},
  ) => {
    // Prefix ownership is checked before the source and instance rows exist, so a
    // rejected enable leaves nothing behind to clean up.
    try {
      await assertProjectChoice(input.projectId, input.extensionId);
      await assertExpectedExtensionProvider(getProjectExtensionInstance, input, options.expectedProvider);
      await deps.validateResourcePrefixes?.(input.projectId, {
        extension_id: input.extensionId,
        source_kind: input.sourceKind ?? "local_path",
        source_path: input.sourcePath,
        preparedRevision: input.preparedRevision,
      });
      await assertProjectExists(input.projectId);
      const installedSource = await registerInstalledSource(input);
      const existing = await findProjectInstanceForSource(input, installedSource);
      const candidate = existing ?? (await createProjectInstance(input, installedSource));
      const instance = await claimExtensionId(candidate, installedSource, options.expectedProvider);
      if (!instance) throw new Error(`Failed to enable extension: ${input.name}`);
      // Registration precedes the first enabled owner, so its execution-gated
      // notification cannot finish this source's frontend until the claim exists.
      if (!existing?.enabled)
        await withRequestedPreparation(() => notifyInstalledSourcesChanged(installedSource.source_path));

      return { installedSource, instance };
    } catch (error) {
      if (input.installation) await settlePreparedInstall(input.installation, false);
      throw error;
    }
  };

  const mutateSourceAndRefresh = createExtensionSourceRefresh(mutateSource, notifyInstalledSourcesChanged);

  const attachProjectInstance = async (
    projectId: string,
    installedSource: Awaited<ReturnType<typeof registerInstalledSource>>,
  ) => {
    const existing = await findProjectInstanceForSource({ projectId }, installedSource);
    const candidate = existing ?? (await createProjectInstance({ projectId }, installedSource));
    if (!existing) emitExtensionInstance(candidate);
    if (candidate.enabled || !(await isAlwaysEnabledExtensionSource(installedSource)))
      return { installedSource, instance: candidate };
    await deps.validateResourcePrefixes?.(projectId, installedSource);
    const instance = await claimExtensionId(candidate, installedSource);
    if (!instance) throw new Error(`Failed to attach extension: ${installedSource.extension_id}`);
    return { installedSource, instance };
  };

  const syncInstalledSourceForProject = (input: SyncInstalledSourceInput) =>
    mutateSourceAndRefresh(input.sourcePath, async (notify) => {
      if (!(deps.sourceExists ?? existsSync)(input.sourcePath)) return null;
      await assertProjectExists(input.projectId);
      const { installedSource, created } = await attachInstalledSource(input, notify);
      // The user's existing installation outlives the last project that used it.
      const preserveSource = !created && relative(pstdioExtensionsRoot(), dirname(installedSource.source_path)) === "";
      return attachUnlessRemoved(deps, input.projectId, installedSource, attachProjectInstance, preserveSource);
    });

  const attachRegisteredSourceForProject = async (input: { projectId: string; installedSourceId: string }) => {
    const source = await deps.installedExtensionSourcesService.get(input.installedSourceId);
    if (!source) return null;
    return mutateSource(source.source_path, async () => {
      const current = await deps.installedExtensionSourcesService.get(source.id);
      if (!current || !(deps.sourceExists ?? existsSync)(current.source_path)) return null;
      await assertProjectExists(input.projectId);
      return attachProjectInstance(input.projectId, current);
    });
  };

  const removeProjectExtensionInstance = async (instanceId: string) => {
    const removed = await deps.extensionInstancesService.remove(instanceId);
    if (removed) deps.eventBus?.emit("extension_instances", "delete", removed);
    return removed;
  };

  const pruneProjectExtensionInstances = async (input: PruneProjectExtensionInstancesInput) => {
    const project = await deps.projectService.get(input.projectId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    return pruneProjectExtensionInstancesImpl({ ...deps, notifyInstalledSourcesChanged }, input);
  };

  return serializeExtensionChoices(
    {
      assertInstalledSourceChoice,
      adoptDefaultSourceForProject,
      hasDefaultSourceChoice: deps.extensionInstancesService.hasProjectDefaultChoice,
      activatePublishedExtensions: (inputs: Parameters<typeof activatePublishedExtensions>[1]) =>
        activatePublishedExtensions(
          {
            sources: deps.installedExtensionSourcesService,
            instances: deps.extensionInstancesService,
            emitRemoved: (row) => deps.eventBus?.emit("installed_extension_sources", "delete", row),
            emitInstance: emitExtensionInstance,
            emitInstanceRemoved: (row) => deps.eventBus?.emit("extension_instances", "delete", row),
            refresh: notifyInstalledSourcesChanged,
            emit: emitInstalledSource,
          },
          inputs,
        ),
      enableInstalledSourceForProject,
      attachRegisteredSourceForProject,
      getInstalledSource,
      getInstalledSourceById: deps.installedExtensionSourcesService.get,
      getProjectExtensionInstance,
      hasEnabledProjectSource,
      listEnabledSourcesForProject,
      listProjectExtensionInstances: listProjectInstances,
      installedSourceProjectIds: async (sourceId: string) =>
        (await deps.extensionInstancesService.list({ installed_extension_id: sourceId, scope_type: "project" })).map(
          ({ scope_id }) => scope_id,
        ),
      reloadInstalledSourceBySourcePath: (sourcePath: string) =>
        reloadInstalledSourceBySourcePathImpl(reloadDeps, sourcePath),
      removeProjectExtensionInstance,
      pruneProjectExtensionInstances,
      removeUnusedFolderSources: (folder: string) =>
        removeUnusedFolderSources({ ...deps, notifyInstalledSourcesChanged }, folder),
      ...createWebviewBuildReports(reloadDeps, mutateSource),
      registerInstalledSource,
      setProjectExtensionEnabled,
      syncInstalledSourceForProject,
      uninstallProjectExtension: async (input: { instanceId: string; projectId: string; deleteUserData?: boolean }) => {
        const record = await getProjectExtensionInstance(input.projectId, input.instanceId);
        if (!record) return null;
        await assertProjectChoice(input.projectId, record.installedSource.extension_id);
        await assertOptional(record.installedSource);
        return mutateSourceAndRefresh(record.installedSource.source_path, async (notify) => {
          await assertInstalledSourceChoice(record.installedSource.id);
          return uninstallProjectExtensionImpl({ ...deps, notifyInstalledSourcesChanged: notify }, input);
        });
      },
    },
    (instanceId) => projectOfInstance(deps.extensionInstancesService, instanceId),
  );
};
