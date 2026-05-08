import { dirname } from "node:path";
import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";
import { checkExtensionSource, hashExtensionSource } from "../features/extensions/extension-runtime";
import type { EventBus } from "../features/sync/event-bus";
import type { createProjectService } from "./project-service";

type JsonRecord = Record<string, unknown>;

export type SourceKind = "builtin" | "git" | "local_path" | "registry";

export type EnableInstalledSourceInput = {
  displayName: string;
  extensionId: string;
  installName: string;
  manifest: JsonRecord;
  namespace: string;
  projectId: string;
  sourceHash?: string | null;
  sourceKind?: SourceKind;
  sourcePath: string;
  sourceRef?: string | null;
  version?: string | null;
};

export type RegisterInstalledSourceInput = Omit<EnableInstalledSourceInput, "projectId">;

export class NamespaceConflictError extends Error {
  namespace: string;

  constructor(namespace: string) {
    super(`Project already has an extension enabled for namespace: ${namespace}`);
    this.name = "NamespaceConflictError";
    this.namespace = namespace;
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

  const errorJson = (code: string, error: unknown, details: JsonRecord = {}) => {
    const diagnostics =
      typeof error === "object" && error !== null && "diagnostics" in error
        ? (error as { diagnostics?: unknown }).diagnostics
        : undefined;

    return {
      code,
      message: error instanceof Error ? error.message : String(error),
      ...(Array.isArray(diagnostics) ? { diagnostics } : {}),
      ...details,
    };
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
    const existing = await deps.extensionInstancesService.findByScopeNamespace(
      "project",
      input.projectId,
      input.namespace,
    );

    if (existing && existing.installed_extension_id !== installedSource.id) {
      throw new NamespaceConflictError(input.namespace);
    }

    const instance = existing
      ? await deps.extensionInstancesService.update(existing.id, { enabled: true })
      : await deps.extensionInstancesService.create({
          installed_extension_id: installedSource.id,
          namespace: input.namespace,
          scope_id: input.projectId,
          scope_type: "project",
        });

    if (!instance) throw new Error(`Failed to enable extension: ${input.namespace}`);

    emitExtensionInstance(instance);

    return { installedSource, instance };
  };

  const setProjectExtensionEnabled = async (instanceId: string, enabled: boolean) => {
    const updated = await deps.extensionInstancesService.update(instanceId, { enabled });
    if (updated) emitExtensionInstance(updated);
    return updated;
  };

  const listEnabledSourcesForProject = async (projectId: string) => {
    const project = await deps.projectService.get(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);

    const instances = await deps.extensionInstancesService.list({ scope_type: "project", scope_id: projectId });
    const enabled = instances.filter((instance) => instance.enabled);
    const records = [];

    for (const instance of enabled) {
      const installedSource = await deps.installedExtensionSourcesService.get(instance.installed_extension_id);
      if (installedSource) records.push({ instance, installedSource });
    }

    return records;
  };

  const reloadInstalledSource = async (installName: string) => {
    const existing = await deps.installedExtensionSourcesService.getByInstallName(installName);
    if (!existing) throw new Error(`Installed extension not found: ${installName}`);

    const hash = deps.hashExtension ?? hashExtensionSource;
    const check = deps.checkExtension ?? checkExtensionSource;
    let nextSourceHash: string | null = null;

    try {
      nextSourceHash = hash(existing.source_path);
      const result = await check(existing.source_path, dirname(existing.source_path));
      if (!result.loaded || result.check.errorCount > 0) {
        throw Object.assign(new Error("Extension validation failed"), { diagnostics: result.check.diagnostics });
      }

      const updated = await deps.installedExtensionSourcesService.updateRegistration(existing.id, {
        display_name: result.loaded.metadata.name,
        extension_id: result.loaded.metadata.id,
        manifest_json: result.loaded.manifest,
        source_hash: nextSourceHash,
        status: "loaded",
        version: result.loaded.metadata.version ?? null,
        last_loaded_at: new Date().toISOString(),
        last_error_json: null,
      });
      if (!updated) throw new Error(`Installed extension not found: ${installName}`);

      await deps.installedExtensionSourcesService.recordReload({
        installed_extension_id: existing.id,
        previous_source_hash: existing.source_hash,
        next_source_hash: nextSourceHash,
        previous_revision: existing.loaded_revision,
        next_revision: existing.loaded_revision,
        status: "success",
      });

      emitInstalledSource(updated);
      await notifyInstalledSourcesChanged();
      return { installedSource: updated, check: result.check };
    } catch (error) {
      const currentErrorJson = errorJson("extension_reload_failed", error);
      const updated = await deps.installedExtensionSourcesService.updateLoadState(existing.id, {
        source_hash: nextSourceHash ?? existing.source_hash,
        status: "error",
        last_error_json: currentErrorJson,
      });
      if (!updated) throw new Error(`Installed extension not found: ${installName}`);

      await deps.installedExtensionSourcesService.recordReload({
        installed_extension_id: existing.id,
        previous_source_hash: existing.source_hash,
        next_source_hash: nextSourceHash ?? existing.source_hash,
        previous_revision: existing.loaded_revision,
        next_revision: existing.loaded_revision,
        status: "error",
        error_json: currentErrorJson,
      });

      emitInstalledSource(updated);
      await notifyInstalledSourcesChanged();
      return { installedSource: updated, check: null };
    }
  };

  const reportWebviewBuildFailure = async (installName: string, webviewId: string, error: unknown) => {
    const existing = await deps.installedExtensionSourcesService.getByInstallName(installName);
    if (!existing) throw new Error(`Installed extension not found: ${installName}`);

    const currentErrorJson = errorJson("extension_webview_build_failed", error, { webviewId });
    const updated = await deps.installedExtensionSourcesService.updateLoadState(existing.id, {
      status: "error",
      last_error_json: currentErrorJson,
    });
    if (!updated) throw new Error(`Installed extension not found: ${installName}`);

    await deps.installedExtensionSourcesService.recordReload({
      installed_extension_id: existing.id,
      previous_source_hash: existing.source_hash,
      next_source_hash: existing.source_hash,
      previous_revision: existing.loaded_revision,
      next_revision: existing.loaded_revision,
      status: "error",
      error_json: currentErrorJson,
    });

    emitInstalledSource(updated);
    return updated;
  };

  const reportWebviewBuildSuccess = async (installName: string, webviewId: string) => {
    const existing = await deps.installedExtensionSourcesService.getByInstallName(installName);
    if (!existing) throw new Error(`Installed extension not found: ${installName}`);

    const currentError = existing.last_error_json;
    const shouldClear =
      currentError &&
      typeof currentError === "object" &&
      "code" in currentError &&
      currentError.code === "extension_webview_build_failed" &&
      "webviewId" in currentError &&
      currentError.webviewId === webviewId;

    if (!shouldClear) return existing;

    const updated = await deps.installedExtensionSourcesService.updateLoadState(existing.id, {
      status: "loaded",
      last_error_json: null,
    });
    if (!updated) throw new Error(`Installed extension not found: ${installName}`);

    emitInstalledSource(updated);
    return updated;
  };

  return {
    enableInstalledSourceForProject,
    getInstalledSource,
    listEnabledSourcesForProject,
    reloadInstalledSource,
    reportWebviewBuildFailure,
    reportWebviewBuildSuccess,
    registerInstalledSource,
    setProjectExtensionEnabled,
  };
};
