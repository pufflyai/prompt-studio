import { existsSync } from "node:fs";
import { dirname, relative } from "node:path";
import type {
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
} from "pstdio-db";
import { type PreparedExtensionRevision, pstdioExtensionsRoot, withRequestedPreparation } from "pstdio-extensions";
import { isAlwaysEnabledExtensionSource } from "../features/extensions/always-on-extensions";
import {
  type ExtensionInstallTransaction,
  settlePreparedInstall,
} from "../features/extensions/extension-install-transaction";
import type {
  checkExtensionSource,
  hashExtensionSource,
  LoadedExtensionSnapshot,
} from "../features/extensions/extension-runtime";
import type { EventBus } from "../features/sync/event-bus";
import { activatePublishedExtensions } from "./activate-published-extension";
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
import type { createProjectService } from "./project-service";

export type { PruneProjectExtensionInstancesInput } from "./extension-prune";

type JsonRecord = Record<string, unknown>;

export type SourceKind = "git" | "local_path" | "registry";

export type EnableInstalledSourceInput = {
  installation?: ExtensionInstallTransaction;
  preparedRevision?: PreparedExtensionRevision;
  displayName: string;
  extensionId: string;
  installName: string;
  manifest: JsonRecord;
  /** Package name from the manifest; used for diagnostics. The persisted name is derived from the source. */
  name: string;
  projectId: string;
  sourceHash?: string | null;
  sourceKind?: SourceKind;
  sourcePath: string;
  sourceRef?: string | null;
  version?: string | null;
};

export type SyncInstalledSourceInput = EnableInstalledSourceInput;

export type RegisterInstalledSourceInput = Omit<EnableInstalledSourceInput, "projectId">;

export class ExtensionNameConflictError extends Error {
  extensionName: string;

  constructor(extensionName: string) {
    super(`Project already has an extension enabled with name: ${extensionName}`);
    this.name = "ExtensionNameConflictError";
    this.extensionName = extensionName;
  }
}

export class ProjectNotFoundError extends Error {
  projectId: string;

  constructor(projectId: string) {
    super(`Project not found: ${projectId}`);
    this.name = "ProjectNotFoundError";
    this.projectId = projectId;
  }
}

import type { createFileService } from "./file-service";

type ExtensionServiceDeps = {
  fileService?: Pick<ReturnType<typeof createFileService>, "remove" | "recoverRemovals">;
  extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  extensionUserDataService: ReturnType<typeof createExtensionUserDataDBService>;
  /** Deleting an extension's data waits for a running capture or restore of its project. */
  recovery: Pick<ReturnType<typeof createExtensionStorageDBService>["recovery"], "exclusive">;
  eventBus?: EventBus;
  hashExtension?: typeof hashExtensionSource;
  onInstalledSourcesChanged?: (sourcePath?: string, validatedSource?: LoadedExtensionSnapshot) => Promise<void> | void;
  checkExtension?: typeof checkExtensionSource;
  sourceExists?: typeof existsSync;
  projectService: ReturnType<typeof createProjectService>;
  validateResourcePrefixes?: (
    projectId: string,
    source: {
      extension_id: string;
      source_kind: SourceKind;
      source_path: string;
      preparedRevision?: PreparedExtensionRevision;
    },
  ) => Promise<void>;
};

const projectOfInstance = async (instances: ExtensionServiceDeps["extensionInstancesService"], id: string) => {
  const instance = await instances.get(id);
  return instance?.scope_type === "project" ? instance.scope_id : null;
};

// A project removed between the sync's check and attachment can no longer own the instance.
const attachUnlessRemoved = async <Source extends { id: string }, Attached extends { instance: { id: string } }>(
  deps: ExtensionServiceDeps,
  projectId: string,
  installedSource: Source,
  attach: (projectId: string, installedSource: Source) => Promise<Attached>,
  preserveSource: boolean,
) => {
  const installedSourceId = installedSource.id;
  const attached = await attach(projectId, installedSource).catch(async (error) => {
    if (await deps.projectService.get(projectId)) throw error;
    return null;
  });
  if (attached && (await deps.projectService.get(projectId))) return attached;
  // A failed attach may already have added the instance, so it is found by project and source.
  const instance =
    attached?.instance ??
    (await deps.extensionInstancesService.findByScopeInstalledSource("project", projectId, installedSourceId));
  if (instance && (await deps.extensionInstancesService.remove(instance.id)))
    deps.eventBus?.emit("extension_instances", "delete", instance);
  if (!preserveSource) {
    const users = await deps.extensionInstancesService.list({ installed_extension_id: installedSourceId });
    if (users.length === 0 && (await deps.installedExtensionSourcesService.remove(installedSourceId)))
      deps.eventBus?.emit("installed_extension_sources", "delete", { id: installedSourceId });
  }
  throw new ProjectNotFoundError(projectId);
};

// Discovery reads metadata and hashes separately. A folder swap can pair stale
// metadata with the new hash. A loaded, versioned source owns its accepted metadata.
const keepDiscoveredRegistration = (
  existing: { source_hash: string | null; status: string; version: string | null },
  input: RegisterInstalledSourceInput,
) =>
  existing.source_hash &&
  input.sourceHash &&
  (existing.source_hash !== input.sourceHash || (existing.status === "loaded" && existing.version !== null));

export const createExtensionService = (deps: ExtensionServiceDeps) => {
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
      emitExtensionInstance,
      onDefaultAdopted: (sourcePath) => withRequestedPreparation(() => notifyInstalledSourcesChanged(sourcePath)),
    });

  const notifyInstalledSourcesChanged = async (sourcePath?: string, validatedSource?: LoadedExtensionSnapshot) => {
    await deps.onInstalledSourcesChanged?.(sourcePath, validatedSource);
  };

  const reloadDeps = {
    installedExtensionSourcesService: deps.installedExtensionSourcesService,
    emitInstalledSource,
    notifyInstalledSourcesChanged,
    hashExtension: deps.hashExtension,
    checkExtension: deps.checkExtension,
  };

  const registerSource = createInstalledSourceRegistrar({
    sources: deps.installedExtensionSourcesService,
    emitInstalledSource,
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
    if (existing && keepDiscoveredRegistration(existing, input)) {
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

  const listEnabledSourcesForProject = async (projectId: string) => {
    const records = await listProjectInstances(projectId);
    return records.filter(({ instance }) => instance.enabled);
  };

  const hasEnabledProjectSource = async (sourcePath: string) => {
    const source = await deps.installedExtensionSourcesService.getBySourcePath(sourcePath);
    if (!source) return false;
    const filters = { installed_extension_id: source.id, scope_type: "project" };
    return (await deps.extensionInstancesService.list(filters)).some((instance) => instance.enabled);
  };

  const listProjectInstances = async (projectId: string) => {
    const project = await deps.projectService.get(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);

    const instances = await deps.extensionInstancesService.list({ scope_type: "project", scope_id: projectId });
    const records = [];

    for (const instance of instances) {
      const installedSource = await deps.installedExtensionSourcesService.get(instance.installed_extension_id);
      if (installedSource) records.push({ instance, installedSource });
    }

    return records;
  };

  const getProjectExtensionInstance = async (projectId: string, instanceId: string) => {
    const instance = await deps.extensionInstancesService.get(instanceId);
    if (!instance) return null;
    if (instance.scope_type !== "project" || instance.scope_id !== projectId) return null;

    const installedSource = await deps.installedExtensionSourcesService.get(instance.installed_extension_id);
    if (!installedSource) return null;

    return { instance, installedSource };
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
        await assertOptional(record.installedSource);
        return mutateSourceAndRefresh(record.installedSource.source_path, (notify) =>
          uninstallProjectExtensionImpl({ ...deps, notifyInstalledSourcesChanged: notify }, input),
        );
      },
    },
    (instanceId) => projectOfInstance(deps.extensionInstancesService, instanceId),
  );
};
