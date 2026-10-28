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
import { createFileConnectionSecretStore } from "./features/extensions/connection-secret-store";
import {
  createExtensionConnectionService,
  createExtensionConnectionsApi,
} from "./features/extensions/extension-connection-service";
import { subscribeExtensionEnablementInvalidation } from "./features/extensions/extension-enablement-invalidation";
import type { LoadedExtensionSnapshot } from "./features/extensions/extension-runtime";
import { installExtensionSource } from "./features/extensions/install-extension-source";
import { createInstalledExtensionRuntime } from "./features/extensions/installed-extension-runtime";
import { createProjectExtensionRuntimeCatalog } from "./features/extensions/project-extension-runtime-catalog";
import { subscribeProjectWorkspaceExtensionRefresh } from "./features/extensions/project-workspace-extension-refresh";
import { createHarnessPackages } from "./features/harnesses/harness-packages";
import { createHarnessRegistryService } from "./features/harnesses/harness-registry-service";
import { createOnboardingInstaller, enqueueOnboardingExtension } from "./features/onboarding/install-choices";
import { createOnboarding } from "./features/onboarding/onboarding";
import type { EventBus } from "./features/sync/event-bus";
import { apiLogger } from "./lib/logger";
import { logStartupPhase } from "./lib/startup-phase";
import { createExtensionInstallations } from "./services/extension-installations";
import { createExtensionService } from "./services/extension-service";
import { createExtensionUpgradeService } from "./services/extension-upgrade-service";
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
  provisionWorkspacesUsingSource: (sourcePath: string) => Promise<void>;
  workspaceService: ReturnType<typeof createWorkspaceService>;
  storageRoot: string;
}

export const productionAppDependencies: AppDependencies = {
  createHarnessRegistry: createHarnessRegistryService,
  installExtensionSource,
};

export const wireAppExtensionServices = (input: WireExtensionServicesInput) => {
  let installCatalog: ReturnType<typeof createOnboardingInstaller>;
  const extensionInstallations = createExtensionInstallations({
    path: join(input.storageRoot, "extension-installations.json"),
    installCatalog: (name, signal) => installCatalog(name, signal),
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
  installCatalog = createOnboardingInstaller({
    extensionService,
    projectService: input.projectService,
    releaseRef: extensionUpgradeService.releaseRef,
  });
  const onboarding = createOnboarding({
    path: join(input.storageRoot, "onboarding.json"),
    enqueue: (name) => enqueueOnboardingExtension(extensionInstallations, name),
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
  const harnessRegistry = input.dependencies.createHarnessRegistry({
    packages: createHarnessPackages({ installations: extensionInstallations }),
    installedExtensionSourcesService: input.installedExtensionSourcesDBService,
    extensionRuntimeCatalog,
    createConnectionsApi: (scope) => createExtensionConnectionsApi(extensionConnectionService, scope),
  });
  const extensionRuntime = createInstalledExtensionRuntime({
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
    onboarding,
    extensionInstallations,
    extensionStartup,
    extensionRuntime,
    extensionRuntimeCatalog,
    extensionConnectionService,
    extensionService,
    extensionUpgradeService,
    harnessRegistry,
    unsubscribeExtensionEvents: () => {
      unsubscribeProjectWorkspaceRefresh();
      unsubscribeEnablementInvalidation();
    },
  };
};
