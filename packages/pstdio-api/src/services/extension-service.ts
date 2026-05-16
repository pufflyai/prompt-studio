import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";
import type { checkExtensionSource, hashExtensionSource } from "../features/extensions/extension-runtime";
import type { EventBus } from "../features/sync/event-bus";
import {
  reloadInstalledSource as reloadInstalledSourceImpl,
  reportWebviewBuildFailure as reportWebviewBuildFailureImpl,
  reportWebviewBuildSuccess as reportWebviewBuildSuccessImpl,
} from "./extension-reload";
import type { createProjectService } from "./project-service";

type JsonRecord = Record<string, unknown>;

export type SourceKind = "builtin" | "git" | "local_path" | "registry";

export type EnableInstalledSourceInput = {
  displayName: string;
  extensionId: string;
  installName: string;
  manifest: JsonRecord;
  /** Package name (stored as `extension_instances.namespace` for back-compat). */
  name: string;
  projectId: string;
  sourceHash?: string | null;
  sourceKind?: SourceKind;
  sourcePath: string;
  sourceRef?: string | null;
  version?: string | null;
};

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
  eventBus?: EventBus;
  hashExtension?: typeof hashExtensionSource;
  onInstalledSourcesChanged?: () => Promise<void> | void;
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

  const notifyInstalledSourcesChanged = async () => {
    await deps.onInstalledSourcesChanged?.();
  };

  const reloadDeps = {
    installedExtensionSourcesService: deps.installedExtensionSourcesService,
    emitInstalledSource,
    notifyInstalledSourcesChanged,
    hashExtension: deps.hashExtension,
    checkExtension: deps.checkExtension,
  };

  const registerInstalledSource = async (input: RegisterInstalledSourceInput) => {
    const existing = await deps.installedExtensionSourcesService.getByInstallName(input.installName);
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
      const updated = await deps.installedExtensionSourcesService.updateRegistration(existing.id, values);
      if (!updated) throw new Error(`Installed extension not found: ${input.installName}`);
      emitInstalledSource(updated);
      await notifyInstalledSourcesChanged();
      return updated;
    }

    const registered = await deps.installedExtensionSourcesService.register({
      install_name: input.installName,
      ...values,
    });
    emitInstalledSource(registered);
    await notifyInstalledSourcesChanged();
    return registered;
  };

  const getInstalledSource = (installName: string) =>
    deps.installedExtensionSourcesService.getByInstallName(installName);

  const enableInstalledSourceForProject = async (input: EnableInstalledSourceInput) => {
    const project = await deps.projectService.get(input.projectId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const installedSource = await registerInstalledSource(input);
    const existing = await deps.extensionInstancesService.findByScopeNamespace("project", input.projectId, input.name);

    if (existing && existing.installed_extension_id !== installedSource.id) {
      throw new ExtensionNameConflictError(input.name);
    }

    const instance = existing
      ? await deps.extensionInstancesService.update(existing.id, { enabled: true })
      : await deps.extensionInstancesService.create({
          installed_extension_id: installedSource.id,
          namespace: input.name,
          scope_id: input.projectId,
          scope_type: "project",
        });

    if (!instance) throw new Error(`Failed to enable extension: ${input.name}`);

    emitExtensionInstance(instance);

    return { installedSource, instance };
  };

  const setProjectExtensionEnabled = async (instanceId: string, enabled: boolean) => {
    const updated = await deps.extensionInstancesService.update(instanceId, { enabled });
    if (updated) emitExtensionInstance(updated);
    return updated;
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
    if (removed) deps.eventBus?.emit("extension_instances", "delete", { id: instanceId });
    return removed;
  };

  return {
    enableInstalledSourceForProject,
    getInstalledSource,
    getProjectExtensionInstance,
    listEnabledSourcesForProject,
    listProjectExtensionInstances: listProjectInstances,
    reloadInstalledSource: (installName: string) => reloadInstalledSourceImpl(reloadDeps, installName),
    removeProjectExtensionInstance,
    reportWebviewBuildFailure: (installName: string, webviewId: string, error: unknown) =>
      reportWebviewBuildFailureImpl(reloadDeps, installName, webviewId, error),
    reportWebviewBuildSuccess: (installName: string, webviewId: string) =>
      reportWebviewBuildSuccessImpl(reloadDeps, installName, webviewId),
    registerInstalledSource,
    setProjectExtensionEnabled,
  };
};
