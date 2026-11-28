import type { existsSync } from "node:fs";
import type {
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
} from "pstdio-db";
import type { PreparedExtensionRevision } from "pstdio-extensions";
import type { ExtensionInstallTransaction } from "../features/extensions/extension-install-transaction";
import type {
  checkExtensionSource,
  hashExtensionSource,
  LoadedExtensionSnapshot,
} from "../features/extensions/extension-runtime";
import type { EventBus } from "../features/sync/event-bus";
import type { ExtensionChoicePolicy } from "./extension-choice-policy";
import type { createProjectService } from "./project-service";

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

export type ExtensionServiceDeps = ExtensionChoicePolicy & {
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

export const projectOfInstance = async (instances: ExtensionServiceDeps["extensionInstancesService"], id: string) => {
  const instance = await instances.get(id);
  return instance?.scope_type === "project" ? instance.scope_id : null;
};

// A project removed between the sync's check and attachment can no longer own the instance.
export const attachUnlessRemoved = async <Source extends { id: string }, Attached extends { instance: { id: string } }>(
  deps: ExtensionServiceDeps,
  projectId: string,
  installedSource: Source,
  attach: (projectId: string, installedSource: Source) => Promise<Attached | null>,
  preserveSource: boolean,
) => {
  const installedSourceId = installedSource.id;
  const attached = await attach(projectId, installedSource).catch(async (error) => {
    if (await deps.projectService.get(projectId)) throw error;
    return null;
  });
  if (await deps.projectService.get(projectId)) return attached;
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

export const createExtensionSourceReaders = (
  deps: Pick<ExtensionServiceDeps, "extensionInstancesService" | "installedExtensionSourcesService" | "projectService">,
) => {
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

  return { listEnabledSourcesForProject, hasEnabledProjectSource, listProjectInstances, getProjectExtensionInstance };
};
