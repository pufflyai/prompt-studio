import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";
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
  projectService: ReturnType<typeof createProjectService>;
};

export const createExtensionService = (deps: ExtensionServiceDeps) => {
  const registerInstalledSource = async (input: EnableInstalledSourceInput) => {
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
      return updated;
    }

    return deps.installedExtensionSourcesService.register({
      install_name: input.installName,
      ...values,
    });
  };

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

    return { installedSource, instance };
  };

  const setProjectExtensionEnabled = async (instanceId: string, enabled: boolean) =>
    deps.extensionInstancesService.update(instanceId, { enabled });

  return {
    enableInstalledSourceForProject,
    registerInstalledSource,
    setProjectExtensionEnabled,
  };
};
