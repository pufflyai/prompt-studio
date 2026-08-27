import {
  createActivityEventsDBService,
  createAutomationDBService,
  createDb,
  createExtensionAutomationPreferencesDBService,
  createExtensionConnectionsDBService,
  createExtensionFilesDBService,
  createExtensionInstancesDBService,
  createExtensionSettingsDBService,
  createExtensionSkillPreferencesDBService,
  createExtensionStorageDBService,
  createExtensionTemplatePreferencesDBService,
  createExtensionUserDataDBService,
  createFilesDBService,
  createInstalledExtensionSourcesDBService,
  createNotificationsDBService,
  createProjectsDBService,
  createProjectTemplateDefaultsDBService,
  createReposDBService,
  createSessionQueueEntriesDBService,
  createSessionsDBService,
  createSettingsDBService,
  createSkillsDBService,
  createTemplatesDBService,
  createWorkspaceSessionsDBService,
  createWorkspacesDBService,
  type DbClient,
  resolveDbPath,
} from "pstdio-db";
import { createFilesStorageService } from "pstdio-storage";
import type { AppOptions } from "./app-options";
import { createFileConnectionSecretStore } from "./features/extensions/connection-secret-store";
import {
  createExtensionConnectionService,
  createExtensionConnectionsApi,
} from "./features/extensions/extension-connection-service";
import { subscribeExtensionEnablementInvalidation } from "./features/extensions/extension-enablement-invalidation";
import type { LoadedExtension } from "./features/extensions/extension-runtime";
import { createExtensionSettingsService } from "./features/extensions/extension-settings-service";
import { createInstalledExtensionRuntime } from "./features/extensions/installed-extension-runtime";
import {
  createProjectExtensionRuntimeCatalog,
  type ProjectExtensionRuntimeCatalog,
} from "./features/extensions/project-extension-runtime-catalog";
import { subscribeRepoLinkExtensionRefresh } from "./features/extensions/repo-link-extension-refresh";
import { createHarnessRegistryService } from "./features/harnesses/harness-registry-service";
import type { EventBus } from "./features/sync/event-bus";
import { apiLogger } from "./lib/logger";
import { isPgliteCheckpointFailure, pgliteRecoverySteps } from "./lib/pglite-recovery-hint";
import { createExtensionFileService } from "./services/extension-file-service";
import { createExtensionService } from "./services/extension-service";
import { createExtensionUpgradeService } from "./services/extension-upgrade-service";
import { createFileService } from "./services/file-service";
import { createNotificationService } from "./services/notification-service";
import { createProjectService } from "./services/project-service";
import { createRepoService } from "./services/repo-service";
import { createSkillService } from "./services/skill-service";
import { createSyncService } from "./services/sync-service";
import { createTemplateService } from "./services/template-service";
import { createWorkspaceService } from "./services/workspace-service";
import { createWorkspaceSessionService } from "./services/workspace-session-service";

const resolveExtensionWebviewBuilds = (value: boolean | undefined) => {
  if (value !== undefined) return value;
  return process.env.PSTDIO_EXTENSION_WEBVIEW_BUILDS !== "0";
};

const resolveExtensionReleaseRef = (configured: string | undefined) =>
  configured ?? process.env.PSTDIO_EXTENSION_RELEASE_REF;

const resolveExtensionSourceRoot = (configured: string | undefined) =>
  configured ?? process.env.PSTDIO_EXTENSION_SOURCE_ROOT;

const pgliteRecoveryHint = (error: unknown, dbPath: string | undefined) => {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  if (!isPgliteCheckpointFailure(message)) return null;

  const resolved = resolveDbPath(dbPath);
  return `PGlite failed to open ${resolved}. ${pgliteRecoverySteps(resolved)}.`;
};

const openDb = async (dbPath: string | undefined, onLockAcquired?: () => void) => {
  try {
    return await createDb({ path: dbPath, onLockAcquired });
  } catch (err) {
    const hint = pgliteRecoveryHint(err, dbPath);
    apiLogger.error({ dataDir: dbPath, err, event: "db.open.failed", hint }, hint ?? "PGlite database failed to open");
    if (!hint) throw err;

    throw new Error(hint, { cause: err });
  }
};

export const createDBServices = (db: DbClient) => ({
  projectsDBService: createProjectsDBService(db),
  automationDBService: createAutomationDBService(db),
  reposDBService: createReposDBService(db),
  sessionQueueEntriesService: createSessionQueueEntriesDBService(db),
  sessionsDBService: createSessionsDBService(db),
  settingsDBService: createSettingsDBService(db),
  workspacesDBService: createWorkspacesDBService(db),
  workspaceSessionsDBService: createWorkspaceSessionsDBService(db),
  skillsDBService: createSkillsDBService(db),
  templatesDBService: createTemplatesDBService(db),
  filesDBService: createFilesDBService(db),
  activityEventsService: createActivityEventsDBService(db),
  notificationsDbService: createNotificationsDBService(db),
  installedExtensionSourcesService: createInstalledExtensionSourcesDBService(db),
  extensionInstancesService: createExtensionInstancesDBService(db),
  extensionConnectionsDBService: createExtensionConnectionsDBService(db),
  extensionFilesDBService: createExtensionFilesDBService(db),
  extensionTemplatePreferencesDBService: createExtensionTemplatePreferencesDBService(db),
  extensionSkillPreferencesDBService: createExtensionSkillPreferencesDBService(db),
  extensionAutomationPreferencesService: createExtensionAutomationPreferencesDBService(db),
  extensionStorageService: createExtensionStorageDBService(db),
  extensionSettingsDBService: createExtensionSettingsDBService(db),
});

export const createCoreDomainServices = (input: {
  db: DbClient;
  dbs: ReturnType<typeof createDBServices>;
  eventBus: EventBus;
  storageRoot: string;
}) => {
  const { db, dbs, eventBus, storageRoot } = input;
  const filesStorageService = createFilesStorageService(storageRoot);
  const fileService = createFileService({ filesDBService: dbs.filesDBService, filesStorageService });

  return {
    fileService,
    projectService: createProjectService({ projectsDBService: dbs.projectsDBService }),
    repoService: createRepoService({ reposDBService: dbs.reposDBService }),
    extensionFileService: createExtensionFileService({
      eventBus,
      extensionFilesDBService: dbs.extensionFilesDBService,
      extensionInstancesDBService: dbs.extensionInstancesService,
      fileService,
    }),
    syncService: createSyncService({ db, eventBus }),
    notificationService: createNotificationService({
      notificationsDb: dbs.notificationsDbService,
      activityEventsService: dbs.activityEventsService,
      eventBus,
    }),
    extensionSettingsService: createExtensionSettingsService({
      extensionSettingsDBService: dbs.extensionSettingsDBService,
    }),
    workspaceSessionService: createWorkspaceSessionService({
      workspaceSessionsDBService: dbs.workspaceSessionsDBService,
      eventBus,
    }),
    workspaceService: createWorkspaceService({ workspacesDb: dbs.workspacesDBService, eventBus }),
  };
};

export const openAppDb = (options: AppOptions) =>
  openDb(options.dbPath ?? process.env.PSTDIO_DB_PATH, options.onDatabaseLockAcquired);

// Wires the extension service, the process-owned runtime snapshot catalog, the
// harness registry, the installed-source runtime processes, and the event-bus
// subscriptions that keep catalog snapshots invalidated.
export const wireExtensionRuntimeServices = async (input: {
  db: DbClient;
  eventBus: EventBus;
  extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
  extensionConnectionsDBService: ReturnType<typeof createExtensionConnectionsDBService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  options: AppOptions;
  projectService: ReturnType<typeof createProjectService>;
  repoService: ReturnType<typeof createRepoService>;
  storageRoot: string;
}) => {
  const {
    db,
    eventBus,
    extensionConnectionsDBService,
    extensionInstancesService,
    installedExtensionSourcesService,
    options,
    storageRoot,
  } = input;
  const { projectService, repoService } = input;
  let refreshInstalledExtensionProcesses: (sourcePath?: string, validatedSource?: LoadedExtension) => Promise<void> =
    async () => {};
  const extensionService = createExtensionService({
    extensionInstancesService,
    installedExtensionSourcesService,
    extensionUserDataService: createExtensionUserDataDBService(db),
    eventBus,
    onInstalledSourcesChanged: async (sourcePath, validatedSource) => {
      // An in-place source reload keeps the same paths, so the registry's path-set
      // signature won't change on its own — drop its cache explicitly.
      harnessRegistry.invalidate();
      await refreshInstalledExtensionProcesses(sourcePath, validatedSource);
    },
    projectService,
  });
  const extensionUpgradeService = createExtensionUpgradeService({
    extensionService,
    installExtensionSource: options.installExtensionSource,
    releaseRef: resolveExtensionReleaseRef(options.extensionReleaseRef),
    repoService,
    sourceRoot: resolveExtensionSourceRoot(options.extensionSourceRoot),
  });
  const extensionRuntimeCatalog = createProjectExtensionRuntimeCatalog({
    extensionService,
    projectService,
    repoService,
  });
  const extensionConnectionService = createExtensionConnectionService({
    connectionsDBService: extensionConnectionsDBService,
    secretStore: options.connectionSecretStore ?? createFileConnectionSecretStore(storageRoot),
    getContribution: async ({ projectId, extensionId, connectionId }) => {
      const snapshot = await extensionRuntimeCatalog.get(projectId);
      return snapshot.runtime.connections.find(
        (record) => record.extensionId === extensionId && record.localId === connectionId,
      )?.contribution;
    },
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
  const harnessRegistry =
    options.harnessRegistry ??
    createHarnessRegistryService({
      installedExtensionSourcesService,
      extensionRuntimeCatalog,
      createConnectionsApi: (scope) => createExtensionConnectionsApi(extensionConnectionService, scope),
    });
  const extensionRuntime = await createInstalledExtensionRuntime({
    extensionService,
    harnessRegistry,
    installedExtensionSourcesService,
    projectRuntimeCatalog: extensionRuntimeCatalog,
    projectService,
    repoService,
    webviewBuilds: resolveExtensionWebviewBuilds(options.extensionWebviewBuilds),
  });
  refreshInstalledExtensionProcesses = extensionRuntime.refresh;
  const unsubscribeRepoLinkRefresh = subscribeRepoLinkExtensionRefresh({
    eventBus,
    invalidate: extensionRuntimeCatalog.invalidate,
    refreshWatchers: () => extensionRuntime.refreshWatchers(),
    onError: (err) =>
      apiLogger.error(
        { err, event: "extensions.repo_link_refresh.error" },
        "Failed to refresh extensions after repo link change",
      ),
  });
  const unsubscribeEnablementInvalidation = subscribeExtensionEnablementInvalidation({
    eventBus,
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

export const createCatalogServices = (input: {
  db: DbClient;
  dbs: ReturnType<typeof createDBServices>;
  extensionRuntimeCatalog: ProjectExtensionRuntimeCatalog;
  fileService: ReturnType<typeof createFileService>;
}) => ({
  templateService: createTemplateService({
    extensionRuntimeCatalog: input.extensionRuntimeCatalog,
    extensionTemplatePreferencesDBService: input.dbs.extensionTemplatePreferencesDBService,
    fileService: input.fileService,
    projectTemplateDefaultsDBService: createProjectTemplateDefaultsDBService(input.db),
    templatesDBService: input.dbs.templatesDBService,
  }),
  skillService: createSkillService({
    extensionRuntimeCatalog: input.extensionRuntimeCatalog,
    extensionSkillPreferencesDBService: input.dbs.extensionSkillPreferencesDBService,
    fileService: input.fileService,
    skillsDBService: input.dbs.skillsDBService,
  }),
});
