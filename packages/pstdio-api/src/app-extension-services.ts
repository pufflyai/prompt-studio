import {
  type createExtensionConnectionsDBService,
  type createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  type createInstalledExtensionSourcesDBService,
  type DbClient,
} from "pstdio-db";
import type { AppConfig } from "./app-config";
import type { AppDependencies } from "./app-contracts";
import { createFileConnectionSecretStore } from "./features/extensions/connection-secret-store";
import {
  createExtensionConnectionService,
  createExtensionConnectionsApi,
} from "./features/extensions/extension-connection-service";
import { subscribeExtensionEnablementInvalidation } from "./features/extensions/extension-enablement-invalidation";
import type { LoadedExtension } from "./features/extensions/extension-runtime";
import { installExtensionSource } from "./features/extensions/install-extension-source";
import { createInstalledExtensionRuntime } from "./features/extensions/installed-extension-runtime";
import { createProjectExtensionRuntimeCatalog } from "./features/extensions/project-extension-runtime-catalog";
import { subscribeRepoLinkExtensionRefresh } from "./features/extensions/repo-link-extension-refresh";
import { createHarnessRegistryService } from "./features/harnesses/harness-registry-service";
import type { EventBus } from "./features/sync/event-bus";
import { apiLogger } from "./lib/logger";
import { createExtensionService } from "./services/extension-service";
import { createExtensionUpgradeService } from "./services/extension-upgrade-service";
import type { createProjectService } from "./services/project-service";
import type { createRepoService } from "./services/repo-service";

interface WireExtensionServicesInput {
  config: AppConfig["extensions"];
  db: DbClient;
  dependencies: AppDependencies;
  eventBus: EventBus;
  extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
  extensionConnectionsDBService: ReturnType<typeof createExtensionConnectionsDBService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  projectService: ReturnType<typeof createProjectService>;
  repoService: ReturnType<typeof createRepoService>;
  storageRoot: string;
}

export const productionAppDependencies: AppDependencies = {
  createHarnessRegistry: createHarnessRegistryService,
  installExtensionSource,
};

export const wireAppExtensionServices = async (input: WireExtensionServicesInput) => {
  let refreshInstalledExtensionProcesses: (sourcePath?: string, validatedSource?: LoadedExtension) => Promise<void> =
    async () => {};
  const extensionService = createExtensionService({
    extensionInstancesService: input.extensionInstancesService,
    installedExtensionSourcesService: input.installedExtensionSourcesService,
    extensionUserDataService: createExtensionUserDataDBService(input.db),
    eventBus: input.eventBus,
    onInstalledSourcesChanged: async (sourcePath, validatedSource) => {
      harnessRegistry.invalidate();
      await refreshInstalledExtensionProcesses(sourcePath, validatedSource);
    },
    projectService: input.projectService,
  });
  const extensionUpgradeService = createExtensionUpgradeService({
    extensionService,
    installExtensionSource: input.dependencies.installExtensionSource,
    release: input.config.release,
    repoService: input.repoService,
  });
  const extensionRuntimeCatalog = createProjectExtensionRuntimeCatalog({
    extensionService,
    projectService: input.projectService,
    repoService: input.repoService,
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
    isExtensionInstalled: async (projectId, extensionId) =>
      (await extensionService.listProjectExtensionInstances(projectId)).some(
        ({ installedSource }) => installedSource.extension_id === extensionId,
      ),
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
  await extensionConnectionService.reconcile();
  const harnessRegistry = input.dependencies.createHarnessRegistry({
    installedExtensionSourcesService: input.installedExtensionSourcesService,
    extensionRuntimeCatalog,
    createConnectionsApi: (scope) => createExtensionConnectionsApi(extensionConnectionService, scope),
  });
  const extensionRuntime = await createInstalledExtensionRuntime({
    extensionService,
    harnessRegistry,
    installedExtensionSourcesService: input.installedExtensionSourcesService,
    projectRuntimeCatalog: extensionRuntimeCatalog,
    projectService: input.projectService,
    repoService: input.repoService,
    webviewBuilds: input.config.buildWebviews,
  });
  refreshInstalledExtensionProcesses = extensionRuntime.refresh;
  const unsubscribeRepoLinkRefresh = subscribeRepoLinkExtensionRefresh({
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

  return {
    extensionRuntime,
    extensionRuntimeCatalog,
    extensionConnectionService,
    extensionService,
    extensionUpgradeService,
    harnessRegistry,
    unsubscribeExtensionEvents: () => {
      unsubscribeRepoLinkRefresh();
      unsubscribeEnablementInvalidation();
    },
  };
};
