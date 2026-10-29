import { existsSync } from "node:fs";
import type {
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
} from "pstdio-db";
import { isAlwaysEnabledExtensionSource } from "../features/extensions/always-on-extensions";
import type {
  checkExtensionSource,
  hashExtensionSource,
  LoadedExtensionSnapshot,
} from "../features/extensions/extension-runtime";
import type { EventBus } from "../features/sync/event-bus";
import { activatePublishedExtensions } from "./activate-published-extension";
import { createExtensionEnablement } from "./extension-enablement";
import {
  type PruneProjectExtensionInstancesInput,
  pruneProjectExtensionInstances as pruneProjectExtensionInstancesImpl,
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

type ExtensionServiceDeps = {
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
    source: { extension_id: string; source_kind: SourceKind; source_path: string },
  ) => Promise<void>;
};

export const createExtensionService = (deps: ExtensionServiceDeps) => {
  const mutateSource = createExtensionSourceMutations();
  const emitInstalledSource = (source: unknown) => {
    deps.eventBus?.emit("installed_extension_sources", "set", source);
  };

  const emitExtensionInstance = (instance: unknown) => {
    deps.eventBus?.emit("extension_instances", "set", instance);
  };

  const { assertOptional, claimExtensionId, setProjectExtensionEnabled } = createExtensionEnablement({
    ...deps,
    emitExtensionInstance,
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
  const registerInstalledSource = (input: RegisterInstalledSourceInput) =>
    registerSource(input, notifyInstalledSourcesChanged);

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
      return existing;
    }

    return registerSource(input, notify);
  };

  const resolveProjectInstalledSource = async (
    input: EnableInstalledSourceInput,
    resolveSource: (
      source: RegisterInstalledSourceInput,
    ) => Promise<Awaited<ReturnType<typeof registerInstalledSource>>>,
  ) => {
    const project = await deps.projectService.get(input.projectId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const installedSource = await resolveSource(input);
    const existing = await findProjectInstanceForSource(input, installedSource);

    return { existing, installedSource };
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

  const enableInstalledSourceForProject = async (input: EnableInstalledSourceInput) => {
    // Prefix ownership is checked before the source and instance rows exist, so a
    // rejected enable leaves nothing behind to clean up.
    await deps.validateResourcePrefixes?.(input.projectId, {
      extension_id: input.extensionId,
      source_kind: input.sourceKind ?? "local_path",
      source_path: input.sourcePath,
    });
    const { existing, installedSource } = await resolveProjectInstalledSource(input, registerInstalledSource);

    const candidate = existing ?? (await createProjectInstance(input, installedSource));
    const instance = await claimExtensionId(candidate, installedSource);
    if (!instance) throw new Error(`Failed to enable extension: ${input.name}`);

    return { installedSource, instance };
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
      const { installedSource } = await resolveProjectInstalledSource(input, (source) =>
        attachInstalledSource(source, notify),
      );
      return attachProjectInstance(input.projectId, installedSource);
    });

  const attachRegisteredSourceForProject = async (input: { projectId: string; installedSourceId: string }) => {
    const source = await deps.installedExtensionSourcesService.get(input.installedSourceId);
    if (!source) return null;
    return mutateSource(source.source_path, async () => {
      const current = await deps.installedExtensionSourcesService.get(source.id);
      if (!current || !(deps.sourceExists ?? existsSync)(current.source_path)) return null;
      if (!(await deps.projectService.get(input.projectId))) throw new ProjectNotFoundError(input.projectId);
      return attachProjectInstance(input.projectId, current);
    });
  };

  const listEnabledSourcesForProject = async (projectId: string) => {
    const records = await listProjectInstances(projectId);
    return records.filter(({ instance }) => instance.enabled);
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

  return {
    activatePublishedExtensions: (inputs: Parameters<typeof activatePublishedExtensions>[1]) =>
      activatePublishedExtensions(
        {
          sources: deps.installedExtensionSourcesService,
          instances: deps.extensionInstancesService,
          emitRemoved: (row) => deps.eventBus?.emit("installed_extension_sources", "delete", row),
          emitInstance: emitExtensionInstance,
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
    listEnabledSourcesForProject,
    listProjectExtensionInstances: listProjectInstances,
    reloadInstalledSourceBySourcePath: (sourcePath: string) =>
      reloadInstalledSourceBySourcePathImpl(reloadDeps, sourcePath),
    removeProjectExtensionInstance,
    pruneProjectExtensionInstances,
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
  };
};
