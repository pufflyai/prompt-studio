import { statfs } from "node:fs/promises";
import {
  createActivityEventsDBService,
  createAssetTransfersDBService,
  createAutomationDBService,
  createBoardViewsDBService,
  createDb,
  createDbInWorker,
  createEnvironmentDBService,
  createExtensionAutomationPreferencesDBService,
  createExtensionConnectionsDBService,
  createExtensionFilesDBService,
  createExtensionInstancesDBService,
  createExtensionResourceSequencesDBService,
  createExtensionSettingsDBService,
  createExtensionSkillPreferencesDBService,
  createExtensionStorageDBService,
  createFilesDBService,
  createInstalledExtensionSourcesDBService,
  createNotificationsDBService,
  createPreferencesDBService,
  createProjectInfoDBService,
  createProjectsDBService,
  createResourceLinksDBService,
  createSessionQueueEntriesDBService,
  createSessionsDBService,
  createSettingsDBService,
  createSkillsDBService,
  createWebviewPreferencesDBService,
  createWorkspaceSessionsDBService,
  createWorkspacesDBService,
  type DbClient,
} from "pstdio-db";
import type { AppLifecycle } from "./app-contracts";
import type { EventBus } from "./features/sync/event-bus";
import { publishBoardOwnerRename } from "./features/views/board-owner-renames";
import { apiLogger } from "./lib/logger";
import { isPgliteCheckpointFailure, pgliteRecoverySteps } from "./lib/pglite-recovery-hint";
import { logStartupPhase } from "./lib/startup-phase";
import type { createProjectWork } from "./services/project-work";
import { upgradeArtifactFileProjections } from "./services/shared-files/artifact-projection-upgrade";
import { storageObserver } from "./services/shared-files/storage-observation";

const pgliteRecoveryHint = (error: unknown, dbPath: string) => {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  if (!isPgliteCheckpointFailure(message)) return null;
  return `PGlite failed to open ${dbPath}. ${pgliteRecoverySteps(dbPath)}.`;
};

export const openAppDatabase = async (path: string, lifecycle: AppLifecycle = {}, inWorker = false) => {
  try {
    return await (inWorker ? createDbInWorker : createDb)({
      path,
      deferCleanup: true,
      onLegacyConversionError: ({ owner, error, backupPath }) =>
        apiLogger.error(
          { err: error, owner, backupPath, event: "storage.legacy_conversion.failed" },
          backupPath
            ? "Legacy storage conversion failed; recovery data was saved"
            : "Legacy storage conversion failed; original data was retained",
        ),
      onPhase: (phase) => {
        logStartupPhase(phase);
        if (phase === "database_locked") lifecycle.onDatabaseLockAcquired?.();
      },
    });
  } catch (err) {
    const hint = pgliteRecoveryHint(err, path);
    apiLogger.error({ dataDir: path, err, event: "db.open.failed", hint }, hint ?? "PGlite database failed to open");
    if (!hint) throw err;
    throw new Error(hint, { cause: err });
  }
};

// Recovery points use the free space of the disk that holds the database, with no fixed quota.
const freeBytes = (path: string) => async () => {
  const disk = await statfs(path);
  return disk.bavail * disk.bsize;
};

export const createAppDatabaseServices = (
  db: DbClient,
  databasePath: string,
  work?: ReturnType<typeof createProjectWork>,
  eventBus?: EventBus,
) => ({
  assetTransfersDBService: createAssetTransfersDBService(db),
  environmentDBService: createEnvironmentDBService(db),
  boardViewsDBService: createBoardViewsDBService(db),
  projectsDBService: createProjectsDBService(db),
  automationDBService: createAutomationDBService(db),
  sessionQueueEntriesDBService: createSessionQueueEntriesDBService(db),
  sessionsDBService: createSessionsDBService(db),
  settingsDBService: createSettingsDBService(db),
  workspacesDBService: createWorkspacesDBService(db),
  workspaceSessionsDBService: createWorkspaceSessionsDBService(db),
  skillsDBService: createSkillsDBService(db),
  filesDBService: createFilesDBService(db),
  activityEventsDBService: createActivityEventsDBService(db),
  notificationsDBService: createNotificationsDBService(db),
  installedExtensionSourcesDBService: createInstalledExtensionSourcesDBService(
    db,
    eventBus ? (change) => publishBoardOwnerRename(db, eventBus, change) : undefined,
  ),
  extensionInstancesDBService: createExtensionInstancesDBService(db),
  extensionConnectionsDBService: createExtensionConnectionsDBService(db),
  extensionFilesDBService: createExtensionFilesDBService(db),
  extensionSkillPreferencesDBService: createExtensionSkillPreferencesDBService(db),
  extensionAutomationPreferencesDBService: createExtensionAutomationPreferencesDBService(db),
  extensionStorageDBService: createExtensionStorageDBService(db, storageObserver, {
    freeBytes: freeBytes(databasePath),
    withProjectWork: work?.run,
  }),
  resourceLinksDBService: createResourceLinksDBService(db),
  extensionResourceSequencesDBService: createExtensionResourceSequencesDBService(db),
  projectInfoDBService: createProjectInfoDBService(db),
  extensionSettingsDBService: createExtensionSettingsDBService(db),
  preferencesDBService: createPreferencesDBService(db),
  webviewPreferencesDBService: createWebviewPreferencesDBService(db),
});

export const upgradeAppStorage = async (
  storage: ReturnType<typeof createAppDatabaseServices>["extensionStorageDBService"],
) => {
  await upgradeArtifactFileProjections({
    projections: storage.fileProjections,
    contexts: await storage.fileProjections.legacyContexts(),
  });
};
