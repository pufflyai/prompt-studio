import type {
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
} from "pstdio-db";
import type {
  checkExtensionSource,
  hashExtensionSource,
  LoadedExtension,
} from "../features/extensions/extension-runtime";
import type { EventBus } from "../features/sync/event-bus";
import {
  type PruneProjectExtensionInstancesInput,
  pruneProjectExtensionInstances as pruneProjectExtensionInstancesImpl,
} from "./extension-prune";
import {
  type ExpectedWebviewBuildSource,
  reloadInstalledSourceBySourcePath as reloadInstalledSourceBySourcePathImpl,
  reloadInstalledSource as reloadInstalledSourceImpl,
  reportWebviewBuildFailure as reportWebviewBuildFailureImpl,
  reportWebviewBuildSuccess as reportWebviewBuildSuccessImpl,
} from "./extension-reload";
import {
  findInstalledSourceForRegistration,
  hasUnchangedInstalledSourceRegistration,
  refreshPathForRegistration,
} from "./extension-source-registration";
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
  eventBus?: EventBus;
  hashExtension?: typeof hashExtensionSource;
  onInstalledSourcesChanged?: (sourcePath?: string, validatedSource?: LoadedExtension) => Promise<void> | void;
  checkExtension?: typeof checkExtensionSource;
  projectService: ReturnType<typeof createProjectService>;
};

export const createExtensionService = (deps: ExtensionServiceDeps) => {
  const emitInstalledSource = (source: unknown) => {
    deps.eventBus?.emit("installed_extension_sources", "set", source);
  };

  const emitExtensionInstance = (instance: unknown) => {
    deps.eventBus?.emit("extension_instances", "set", instance);
  };

  const notifyInstalledSourcesChanged = async (sourcePath?: string, validatedSource?: LoadedExtension) => {
    await deps.onInstalledSourcesChanged?.(sourcePath, validatedSource);
  };

  const reloadDeps = {
    installedExtensionSourcesService: deps.installedExtensionSourcesService,
    emitInstalledSource,
    notifyInstalledSourcesChanged,
    hashExtension: deps.hashExtension,
    checkExtension: deps.checkExtension,
  };

  const registerInstalledSource = async (input: RegisterInstalledSourceInput) => {
    const existing = await findInstalledSourceForRegistration(deps.installedExtensionSourcesService, input);
    const values = {
      display_name: input.displayName,
      extension_id: input.extensionId,
      manifest_json: input.manifest,
      source_hash: input.sourceHash ?? existing?.source_hash ?? null,
      source_kind: input.sourceKind ?? existing?.source_kind ?? "local_path",
      source_path: input.sourcePath,
      source_ref: input.sourceRef ?? existing?.source_ref ?? null,
      status: "loaded" as const,
      version: input.version ?? null,
      last_loaded_at: new Date().toISOString(),
      last_error_json: null,
    };

    if (existing) {
      if (hasUnchangedInstalledSourceRegistration(existing, values)) return existing;

      const updated = await deps.installedExtensionSourcesService.updateRegistration(existing.id, values);
      if (!updated) throw new Error(`Installed extension not found: ${input.installName}`);
      emitInstalledSource(updated);
      await notifyInstalledSourcesChanged(refreshPathForRegistration(existing.source_path, input));
      return updated;
    }

    try {
      const registered = await deps.installedExtensionSourcesService.register({
        install_name: input.installName,
        ...values,
      });
      emitInstalledSource(registered);
      await notifyInstalledSourcesChanged(input.sourcePath);
      return registered;
    } catch (error) {
      const raced = await deps.installedExtensionSourcesService.getBySourcePath(input.sourcePath);
      if (!raced) throw error;
      const updated = await deps.installedExtensionSourcesService.updateRegistration(raced.id, values);
      if (!updated) throw error;
      emitInstalledSource(updated);
      await notifyInstalledSourcesChanged(input.sourcePath);
      return updated;
    }
  };

  const getInstalledSource = (installName: string) =>
    deps.installedExtensionSourcesService.getByInstallName(installName);

  const findProjectInstanceForSource = async (
    input: EnableInstalledSourceInput,
    installedSource: Awaited<ReturnType<typeof registerInstalledSource>>,
  ) => {
    return deps.extensionInstancesService.findByScopeInstalledSource("project", input.projectId, installedSource.id);
  };

  // Discovery must never adopt. A folder that changed on disk is an offer the user takes from the
  // extension panel; until then the project keeps running the source it already accepted.
  const attachInstalledSource = async (input: RegisterInstalledSourceInput) => {
    const existing = await deps.installedExtensionSourcesService.getBySourcePath(input.sourcePath);
    if (existing && input.sourceHash && existing.source_hash && input.sourceHash !== existing.source_hash) {
      return existing;
    }

    return registerInstalledSource(input);
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
    input: EnableInstalledSourceInput,
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
    const { existing, installedSource } = await resolveProjectInstalledSource(input, registerInstalledSource);

    const candidate = existing ?? (await createProjectInstance(input, installedSource));
    const instance = await claimExtensionId(candidate, installedSource);
    if (!instance) throw new Error(`Failed to enable extension: ${input.name}`);

    return { installedSource, instance };
  };

  const syncInstalledSourceForProject = async (input: SyncInstalledSourceInput) => {
    const { existing, installedSource } = await resolveProjectInstalledSource(input, attachInstalledSource);
    if (existing) return { installedSource, instance: existing };

    const instance = await createProjectInstance(input, installedSource);

    if (!instance) throw new Error(`Failed to sync extension: ${input.name}`);

    emitExtensionInstance(instance);
    return { installedSource, instance };
  };

  // Every path that turns a project instance on runs the same ownership rule, so the extension
  // panel, project creation, and the CLI cannot leave two sources claiming one extension id.
  const claimExtensionId = async (
    instance: { id: string; scope_id: string },
    installedSource: { extension_id: string },
  ) => {
    const changed = await deps.extensionInstancesService.claimProjectExtensionProvider({
      extensionId: installedSource.extension_id,
      instanceId: instance.id,
      projectId: instance.scope_id,
    });
    for (const changedInstance of changed) emitExtensionInstance(changedInstance);
    return changed.find((changedInstance) => changedInstance.id === instance.id) ?? null;
  };

  const setProjectExtensionEnabled = async (instanceId: string, enabled: boolean) => {
    if (!enabled) {
      const updated = await deps.extensionInstancesService.update(instanceId, { enabled: false });
      if (updated) emitExtensionInstance(updated);
      return updated;
    }

    const instance = await deps.extensionInstancesService.get(instanceId);
    if (!instance) return null;
    if (instance.scope_type !== "project") {
      const updated = await deps.extensionInstancesService.update(instanceId, { enabled: true });
      if (updated) emitExtensionInstance(updated);
      return updated;
    }

    const installedSource = await deps.installedExtensionSourcesService.get(instance.installed_extension_id);
    if (!installedSource) return null;
    return claimExtensionId(instance, installedSource);
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
    enableInstalledSourceForProject,
    getInstalledSource,
    getProjectExtensionInstance,
    listEnabledSourcesForProject,
    listProjectExtensionInstances: listProjectInstances,
    reloadInstalledSource: (installName: string) => reloadInstalledSourceImpl(reloadDeps, installName),
    reloadInstalledSourceBySourcePath: (sourcePath: string) =>
      reloadInstalledSourceBySourcePathImpl(reloadDeps, sourcePath),
    removeProjectExtensionInstance,
    pruneProjectExtensionInstances,
    reportWebviewBuildFailure: (
      installName: string,
      webviewId: string,
      error: unknown,
      expectedSource?: ExpectedWebviewBuildSource,
    ) => reportWebviewBuildFailureImpl(reloadDeps, installName, webviewId, error, expectedSource),
    reportWebviewBuildSuccess: (installName: string, webviewId: string, expectedSource?: ExpectedWebviewBuildSource) =>
      reportWebviewBuildSuccessImpl(reloadDeps, installName, webviewId, expectedSource),
    registerInstalledSource,
    setProjectExtensionEnabled,
    syncInstalledSourceForProject,
    uninstallProjectExtension: (input: { instanceId: string; projectId: string; deleteUserData?: boolean }) =>
      uninstallProjectExtensionImpl({ ...deps, notifyInstalledSourcesChanged }, input),
  };
};
