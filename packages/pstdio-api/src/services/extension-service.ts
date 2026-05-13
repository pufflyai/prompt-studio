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
const LOCAL_OVERRIDE_CONFIG_KEY = "pstdio.localOverride";

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readLocalOverrideSourceId = (config: JsonRecord) => {
  const override = config[LOCAL_OVERRIDE_CONFIG_KEY];
  if (!isJsonRecord(override) || typeof override.installedExtensionId !== "string") return null;
  return override.installedExtensionId;
};

const nextInstanceConfig = (input: {
  existingConfig: JsonRecord;
  existingInstalledSourceId: string;
  isLocalOverride: boolean;
}) => {
  if (!input.isLocalOverride) return input.existingConfig;

  return {
    ...input.existingConfig,
    [LOCAL_OVERRIDE_CONFIG_KEY]: {
      installedExtensionId: readLocalOverrideSourceId(input.existingConfig) ?? input.existingInstalledSourceId,
    },
  };
};

const localOverrideDiagnostic = (input: {
  extensionId: string;
  localSourcePath: string;
  overriddenSourcePath: string;
}): JsonRecord => ({
  code: "extension_overridden_by_local",
  extensionId: input.extensionId,
  message: `Extension id "${input.extensionId}" from ${input.overriddenSourcePath} is overridden by ${input.localSourcePath}`,
  severity: "warning",
  sourcePath: input.localSourcePath,
});

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

export type RegisterInstalledSourceErrorInput = RegisterInstalledSourceInput & {
  error: JsonRecord;
};

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

  const registerInstalledSourceError = async (input: RegisterInstalledSourceErrorInput) => {
    const existing = await deps.installedExtensionSourcesService.getByInstallName(input.installName);
    const values = {
      display_name: input.displayName,
      extension_id: input.extensionId,
      manifest_json: input.manifest,
      source_hash: input.sourceHash ?? existing?.source_hash ?? null,
      source_kind: input.sourceKind ?? existing?.source_kind ?? "local_path",
      source_path: input.sourcePath,
      source_ref: input.sourceRef ?? existing?.source_ref ?? null,
      status: "error" as const,
      version: input.version ?? null,
      last_loaded_at: new Date().toISOString(),
      last_error_json: input.error,
    };

    const source = existing
      ? await deps.installedExtensionSourcesService.updateRegistration(existing.id, values)
      : await deps.installedExtensionSourcesService.register({ install_name: input.installName, ...values });

    if (!source) throw new Error(`Installed extension not found: ${input.installName}`);
    emitInstalledSource(source);
    await notifyInstalledSourcesChanged();
    return source;
  };

  const getInstalledSource = (installName: string) =>
    deps.installedExtensionSourcesService.getByInstallName(installName);

  const enableInstalledSourceForProject = async (input: EnableInstalledSourceInput) => {
    const project = await deps.projectService.get(input.projectId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const installedSource = await registerInstalledSource(input);
    const existing = await deps.extensionInstancesService.findByScopeNamespace("project", input.projectId, input.name);
    let diagnosticsJson: JsonRecord | undefined;

    if (existing && existing.installed_extension_id !== installedSource.id) {
      const existingSource = await deps.installedExtensionSourcesService.get(existing.installed_extension_id);
      if (input.sourceKind !== "local_path" || existingSource?.extension_id !== input.extensionId) {
        throw new ExtensionNameConflictError(input.name);
      }
      diagnosticsJson = {
        diagnostics: [
          localOverrideDiagnostic({
            extensionId: input.extensionId,
            localSourcePath: input.sourcePath,
            overriddenSourcePath: existingSource.source_path,
          }),
        ],
      };
    }

    const existingConfig = isJsonRecord(existing?.config_json) ? existing.config_json : {};
    const nextConfig = existing
      ? nextInstanceConfig({
          existingConfig,
          existingInstalledSourceId: existing.installed_extension_id,
          isLocalOverride: existing.installed_extension_id !== installedSource.id && input.sourceKind === "local_path",
        })
      : existingConfig;

    const updateInput = {
      config_json: nextConfig,
      enabled: true,
      installed_extension_id: installedSource.id,
      ...(diagnosticsJson ? { diagnostics_json: diagnosticsJson } : {}),
    };

    const instance = existing
      ? await deps.extensionInstancesService.update(existing.id, updateInput)
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

  const restoreProjectInstanceFromLocalOverride = async (projectId: string, localSourceId: string) => {
    const [instance] = await deps.extensionInstancesService.list({
      installed_extension_id: localSourceId,
      scope_id: projectId,
      scope_type: "project",
    });
    if (!instance || !isJsonRecord(instance.config_json)) return null;

    const installedExtensionId = readLocalOverrideSourceId(instance.config_json);
    if (!installedExtensionId) return null;

    const restoredSource = await deps.installedExtensionSourcesService.get(installedExtensionId);
    if (!restoredSource) return null;

    const { [LOCAL_OVERRIDE_CONFIG_KEY]: _override, ...config } = instance.config_json;
    const restored = await deps.extensionInstancesService.update(instance.id, {
      config_json: config,
      diagnostics_json: null,
      enabled: true,
      installed_extension_id: restoredSource.id,
    });
    if (restored) emitExtensionInstance(restored);
    return restored;
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

  const listInstalledSourcesByInstallNamePrefix = (prefix: string) =>
    deps.installedExtensionSourcesService.listByInstallNamePrefix(prefix);

  const markInstalledSourceUninstalled = async (sourceId: string) => {
    const source = await deps.installedExtensionSourcesService.updateLoadState(sourceId, {
      status: "uninstalled",
      last_error_json: null,
    });
    if (source) emitInstalledSource(source);
    await notifyInstalledSourcesChanged();
    return source;
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
    listInstalledSourcesByInstallNamePrefix,
    listProjectExtensionInstances: listProjectInstances,
    markInstalledSourceUninstalled,
    reloadInstalledSource: (installName: string) => reloadInstalledSourceImpl(reloadDeps, installName),
    removeProjectExtensionInstance,
    reportWebviewBuildFailure: (installName: string, webviewId: string, error: unknown) =>
      reportWebviewBuildFailureImpl(reloadDeps, installName, webviewId, error),
    reportWebviewBuildSuccess: (installName: string, webviewId: string) =>
      reportWebviewBuildSuccessImpl(reloadDeps, installName, webviewId),
    registerInstalledSource,
    registerInstalledSourceError,
    restoreProjectInstanceFromLocalOverride,
    setProjectExtensionEnabled,
  };
};
