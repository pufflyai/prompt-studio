import { resourceEvents, workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import { createAssetBytesStorage, createFilesStorageService } from "pstdio-storage";
import type { createAppDatabaseServices } from "./app-database";
import type { RouteDeps } from "./features/deps";
import { validateLegacyAnchors } from "./features/extensions/command-environment/resource-link-policy";
import { fireExtensionEventAsync } from "./features/extensions/extension-event-runtime";
import { createExtensionSettingsService } from "./features/extensions/extension-settings-service";
import type { EventBus } from "./features/sync/event-bus";
import { createAssetTransferService } from "./services/asset-transfer-service";
import { createExtensionFileService } from "./services/extension-file-service";
import { createFileService } from "./services/file-service";
import { createNotificationService } from "./services/notification-service";
import { createProjectService } from "./services/project-service";
import { createSettingsService } from "./services/settings-service";
import { createSyncService } from "./services/sync-service";
import { createWorkspaceService } from "./services/workspace-service";
import { createWorkspaceSessionService } from "./services/workspace-session-service";

export const createAppSettingsService = async (input: Parameters<typeof createSettingsService>[0]) => {
  await input.settingsDb.get();
  return createSettingsService(input);
};

export const createCoreDomainServices = (input: {
  getCommandDeps: () => RouteDeps;
  db: Parameters<typeof createAppDatabaseServices>[0];
  dbs: ReturnType<typeof createAppDatabaseServices>;
  eventBus: EventBus;
  storageRoot: string;
}) => {
  const { db, dbs, eventBus, storageRoot } = input;
  dbs.extensionResourceSequencesDBService.watch(({ projectId, ...payload }) =>
    fireExtensionEventAsync(input.getCommandDeps(), projectId, resourceEvents.renumbered, payload),
  );
  const filesStorageService = createFilesStorageService(storageRoot);
  const fileService = createFileService({ filesDBService: dbs.filesDBService, filesStorageService, eventBus });

  const syncService = createSyncService({ db });
  const assetTransferService = createAssetTransferService({
    transfers: dbs.assetTransfersDBService,
    bytes: createAssetBytesStorage(storageRoot),
  });

  return {
    fileService,
    assetTransferService,
    projectService: createProjectService({ projectsDBService: dbs.projectsDBService, syncService, eventBus }),
    extensionFileService: createExtensionFileService({
      extensionFilesDBService: dbs.extensionFilesDBService,
      extensionInstancesDBService: dbs.extensionInstancesDBService,
      fileService,
      assetTransferService,
      installedExtensionSourcesDBService: dbs.installedExtensionSourcesDBService,
      extensionStorageService: dbs.extensionStorageDBService,
    }),
    syncService,
    notificationService: createNotificationService({
      notificationsDb: dbs.notificationsDBService,
      activityEventsService: dbs.activityEventsDBService,
      eventBus,
    }),
    extensionSettingsService: createExtensionSettingsService({
      extensionSettingsDBService: dbs.extensionSettingsDBService,
    }),
    workspaceSessionService: createWorkspaceSessionService({
      workspaceSessionsDBService: dbs.workspaceSessionsDBService,
      eventBus,
    }),
    workspaceService: createWorkspaceService({
      workspacesDb: dbs.workspacesDBService,
      sessionsDb: dbs.sessionsDBService,
      eventBus,
      onCreated: (workspace) =>
        fireExtensionEventAsync(
          input.getCommandDeps(),
          workspace.project_id,
          workspaceEvents.created,
          { workspace },
          workspace,
        ),
      onDeleted: (workspace) =>
        fireExtensionEventAsync(
          input.getCommandDeps(),
          workspace.project_id,
          workspaceEvents.deleted,
          { workspace },
          workspace,
        ),
      validateCreatedAnchors: (source, anchors) => validateLegacyAnchors(input.getCommandDeps(), source, anchors),
    }),
  };
};
