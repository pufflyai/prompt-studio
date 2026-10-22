import {
  createActivityEventsDBService,
  createAssetTransfersDBService,
  createAutomationDBService,
  createBoardViewsDBService,
  createDb,
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
import { apiLogger } from "./lib/logger";
import { isPgliteCheckpointFailure, pgliteRecoverySteps } from "./lib/pglite-recovery-hint";
import { logStartupPhase } from "./lib/startup-phase";
import { storageObserver } from "./services/shared-files/storage-observation";

const pgliteRecoveryHint = (error: unknown, dbPath: string) => {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  if (!isPgliteCheckpointFailure(message)) return null;
  return `PGlite failed to open ${dbPath}. ${pgliteRecoverySteps(dbPath)}.`;
};

export const openAppDatabase = async (path: string, lifecycle: AppLifecycle = {}) => {
  try {
    return await createDb({
      path,
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

export const createAppDatabaseServices = (db: DbClient, snapshotPath?: string) => ({
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
  installedExtensionSourcesDBService: createInstalledExtensionSourcesDBService(db),
  extensionInstancesDBService: createExtensionInstancesDBService(db),
  extensionConnectionsDBService: createExtensionConnectionsDBService(db),
  extensionFilesDBService: createExtensionFilesDBService(db),
  extensionSkillPreferencesDBService: createExtensionSkillPreferencesDBService(db),
  extensionAutomationPreferencesDBService: createExtensionAutomationPreferencesDBService(db),
  extensionStorageDBService: createExtensionStorageDBService(db, storageObserver, snapshotPath),
  resourceLinksDBService: createResourceLinksDBService(db),
  extensionResourceSequencesDBService: createExtensionResourceSequencesDBService(db),
  extensionSettingsDBService: createExtensionSettingsDBService(db),
  webviewPreferencesDBService: createWebviewPreferencesDBService(db),
});
