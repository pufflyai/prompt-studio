import { join } from "node:path";
import {
  type createExtensionConnectionsDBService,
  type createExtensionInstancesDBService,
  type createExtensionStorageDBService,
  createExtensionUserDataDBService,
  type createInstalledExtensionSourcesDBService,
  type DbClient,
} from "pstdio-db";
import type { AppConfig } from "./app-config";
import type { AppDependencies } from "./app-contracts";
import { createCatalogInstaller } from "./features/extensions/catalog-installation";
import { createFileConnectionSecretStore } from "./features/extensions/connection-secret-store";
import {
  createExtensionConnectionService,
  createExtensionConnectionsApi,
} from "./features/extensions/extension-connection-service";
import { subscribeExtensionEnablementInvalidation } from "./features/extensions/extension-enablement-invalidation";
import { createExtensionProcessOwners } from "./features/extensions/extension-process-owners";
import type { LoadedExtensionSnapshot } from "./features/extensions/extension-runtime";
import { createExtensionTargets } from "./features/extensions/extension-targets";
import { installExtensionSource } from "./features/extensions/install-extension-source";
import { createInstalledExtensionRuntime } from "./features/extensions/installed-extension-runtime";
import { createProcessEnvironmentPermissions } from "./features/extensions/process-environment/permissions";
import { completeProjectExtensionInstallation } from "./features/extensions/project-extension-lifecycle";
import { createProjectExtensionRuntimeCatalog } from "./features/extensions/project-extension-runtime-catalog";
import { subscribeProjectWorkspaceExtensionRefresh } from "./features/extensions/project-workspace-extension-refresh";
import { createHarnessRegistryService } from "./features/harnesses/harness-registry-service";
import type { EventBus } from "./features/sync/event-bus";
import type { WorkspacesRouteDeps } from "./features/workspaces/deps";
import { apiLogger } from "./lib/logger";
import { logStartupPhase } from "./lib/startup-phase";
import { createExtensionInstallations } from "./services/extension-installations";
import { createExtensionService, ProjectNotFoundError } from "./services/extension-service";
import { createExtensionUpgradeService } from "./services/extension-upgrade-service";
import type { createFileService } from "./services/file-service";
import type { createProjectService } from "./services/project-service";
import type { createWorkspaceService } from "./services/workspace-service";

interface WireExtensionServicesInput {
  config: AppConfig["extensions"];
  db: DbClient;
  dependencies: AppDependencies;
  eventBus: EventBus;
  extensionInstancesDBService: ReturnType<typeof createExtensionInstancesDBService>;
  extensionStorageDBService: ReturnType<typeof createExtensionStorageDBService>;
  extensionConnectionsDBService: ReturnType<typeof createExtensionConnectionsDBService>;
  installedExtensionSourcesDBService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  projectService: ReturnType<typeof createProjectService>;
  fileService: Pick<ReturnType<typeof createFileService>, "remove" | "recoverRemovals">;
  provisionWorkspacesUsingSource: (sourcePath: string) => Promise<void>;
  getProjectExtensionDeps: () => Parameters<typeof completeProjectExtensionInstallation>[0];
  /** Resolves workspace targets for harness processes and target files once the app dependencies exist. */
  getTargetDeps: () => WorkspacesRouteDeps;
  workspaceService: ReturnType<typeof createWorkspaceService>;
  storageRoot: string;
}

export const productionAppDependencies: AppDependencies = {
  createHarnessRegistry: createHarnessRegistryService,
  installExtensionSource,
};

export const wireAppExtensionServices = (input: WireExtensionServicesInput) => {
  let installCatalog: ReturnType<typeof createCatalogInstaller>;
  const extensionInstallations = createExtensionInstallations({
    path: join(input.storageRoot, "extension-installations.json"),
    installCatalog: (name, signal, projectId) => installCatalog(name, signal, projectId),
    afterCatalogInstall: (name, projectId) =>
      completeProjectExtensionInstallation(input.getProjectExtensionDeps(), projectId, name),
  });
  let refreshInstalledExtensionProcesses: (
    sourcePath?: string,
    validatedSource?: LoadedExtensionSnapshot,
  ) => Promise<void> = async () => {};
  const refreshInstalledSources = async (sourcePath?: string, validatedSource?: LoadedExtensionSnapshot) => {
    harnessRegistry.invalidate();
    await refreshInstalledExtensionProcesses(sourcePath, validatedSource);
  };
  const extensionService = createExtensionService({
    extensionInstancesService: input.extensionInstancesDBService,
    installedExtensionSourcesService: input.installedExtensionSourcesDBService,
    extensionUserDataService: createExtensionUserDataDBService(input.db),
    recovery: input.extensionStorageDBService.recovery,
    fileService: input.fileService,
    eventBus: input.eventBus,
    onInstalledSourcesChanged: refreshInstalledSources,
    projectService: input.projectService,
    validateResourcePrefixes: (projectId, source) =>
      extensionRuntimeCatalog.validateResourcePrefixes(projectId, source),
  });
  const extensionUpgradeService = createExtensionUpgradeService({
    extensionService,
    installExtensionSource: input.dependencies.installExtensionSource,
    release: input.config.release,
    workspaceService: input.workspaceService,
  });
  installCatalog = createCatalogInstaller({
    extensionService,
    extensionUpgradeService,
    installedExtensionSourcesService: input.installedExtensionSourcesDBService,
    releaseRef: extensionUpgradeService.releaseRef,
  });

  const extensionRuntimeCatalog = createProjectExtensionRuntimeCatalog({
    extensionService,
    extensionStorageService: input.extensionStorageDBService,
    projectService: input.projectService,
    workspaceService: input.workspaceService,
  });
  const extensionConnectionService = createExtensionConnectionService({
    connectionsDBService: input.extensionConnectionsDBService,
    secretStore: input.dependencies.connectionSecretStore ?? createFileConnectionSecretStore(input.storageRoot),
    getContribution: async ({ projectId, extensionId, connectionId }) => {
      const snapshot = await extensionRuntimeCatalog.get(projectId);
      return snapshot.runtime.connections.find(
        (record) => record.extensionId === extensionId && record.localId === connectionId,
      )?.contribution;
    },
    isExtensionInstalled: async (projectId, extensionId) => {
      if (projectId === null)
        return (await input.installedExtensionSourcesDBService.list()).some(
          (source) => source.extension_id === extensionId,
        );
      return (await extensionService.listProjectExtensionInstances(projectId)).some(
        ({ installedSource }) => installedSource.extension_id === extensionId,
      );
    },
    onCleanupError: (error, context) =>
      apiLogger.error(
        { err: error, event: "extension.connection_cleanup.deferred", ...context },
        "Extension connection cleanup will retry at startup",
      ),
    onRequestComplete: (audit) =>
      apiLogger.info(
        {
          connection_id: audit.connectionId,
          duration_ms: Math.round(audit.durationMs),
          error: audit.error,
          event: "extension.connection.request.completed",
          extension_id: audit.extensionId,
          method: audit.method,
          path: audit.path,
          project_id: audit.projectId,
          response_bytes: audit.responseBytes,
          status: audit.status,
          success: audit.ok,
        },
        "Extension connection request completed",
      ),
  });
  const extensionProcessEnvironment = createProcessEnvironmentPermissions({
    path: join(input.storageRoot, "extension-process-environment.json"),
    findSource: async (projectId, extensionId, enabledOnly) => {
      try {
        const matching = (await extensionService.listProjectExtensionInstances(projectId)).filter(
          ({ installedSource }) => installedSource.extension_id === extensionId,
        );
        return (
          matching.find(({ instance }) => instance.enabled)?.installedSource ??
          (enabledOnly ? undefined : matching[0]?.installedSource)
        );
      } catch (error) {
        // An unknown project has no extension to grant for.
        if (error instanceof ProjectNotFoundError) return undefined;
        throw error;
      }
    },
  });
  const extensionProcessOwners = createExtensionProcessOwners({
    findEnabledSource: async (projectId, extensionId) => {
      try {
        return (await extensionService.listEnabledSourcesForProject(projectId)).find(
          ({ installedSource }) => installedSource.extension_id === extensionId,
        )?.installedSource;
      } catch (error) {
        if (error instanceof ProjectNotFoundError) return undefined;
        throw error;
      }
    },
  });
  // Disable, removal and changed source content all reach the catalog as invalidations.
  const unsubscribeProcessOwners = extensionRuntimeCatalog.subscribeInvalidation((invalidation) => {
    void extensionProcessOwners.reconcile(invalidation.sourcePath ? undefined : invalidation.projectId);
  });
  const unsubscribeProjectRemoval = input.eventBus.subscribe((event) => {
    if (event.table !== "projects") return;
    const projectId = (event.data as { id?: unknown } | null)?.id;
    if (typeof projectId === "string") void extensionProcessOwners.reconcile(projectId);
  });
  if (process.env.PSTDIO_EXTENSION_PROCESS_ENV)
    apiLogger.warn(
      { event: "extensions.process_environment.legacy_variable" },
      "PSTDIO_EXTENSION_PROCESS_ENV is no longer read. Extensions request host variables in pstdio.processEnvironment, and you allow them per project in the extension's details.",
    );
  const harnessRegistry = input.dependencies.createHarnessRegistry({
    installedExtensionSourcesService: input.installedExtensionSourcesDBService,
    extensionRuntimeCatalog,
    createConnectionsApi: (scope) => createExtensionConnectionsApi(extensionConnectionService, scope),
    processEnvironment: extensionProcessEnvironment,
    targets: createExtensionTargets(input.getTargetDeps),
  });
  const extensionRuntime = createInstalledExtensionRuntime({
    eventBus: input.eventBus,
    extensionService,
    harnessRegistry,
    installedExtensionSourcesService: input.installedExtensionSourcesDBService,
    projectRuntimeCatalog: extensionRuntimeCatalog,
    projectService: input.projectService,
    provisionWorkspacesUsingSource: input.provisionWorkspacesUsingSource,
    workspaceService: input.workspaceService,
    webviewBuilds: input.config.buildWebviews,
  });
  refreshInstalledExtensionProcesses = extensionRuntime.refresh;
  const unsubscribeProjectWorkspaceRefresh = subscribeProjectWorkspaceExtensionRefresh({
    eventBus: input.eventBus,
    invalidate: extensionRuntimeCatalog.invalidate,
    refreshWatchers: () => extensionRuntime.refreshWatchers(),
    onError: (err) =>
      apiLogger.error(
        { err, event: "extensions.repo_link_refresh.error" },
        "Failed to refresh extensions after repo link change",
      ),
  });
  const unsubscribeEnablementInvalidation = subscribeExtensionEnablementInvalidation({
    eventBus: input.eventBus,
    invalidate: extensionRuntimeCatalog.invalidate,
  });
  const extensionStartup = Promise.allSettled([extensionRuntime.ready, extensionConnectionService.reconcile()])
    .then((results) => {
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length)
        throw new AggregateError(
          failures.map((result) => result.reason),
          "Extension startup failed",
        );
      logStartupPhase("extensions_ready");
    })
    .catch((err) => apiLogger.error({ err, event: "extensions.startup.error" }, "Extension startup failed"));

  return {
    extensionInstallations,
    extensionStartup,
    extensionRuntime,
    extensionRuntimeCatalog,
    extensionConnectionService,
    extensionProcessEnvironment,
    extensionProcessOwners,
    extensionService,
    extensionUpgradeService,
    harnessRegistry,
    unsubscribeExtensionEvents: () => {
      unsubscribeProjectWorkspaceRefresh();
      unsubscribeEnablementInvalidation();
      unsubscribeProcessOwners();
      unsubscribeProjectRemoval();
    },
  };
};
