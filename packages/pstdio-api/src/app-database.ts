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
} from "pstdio-db";
import type { AppLifecycle } from "./app-contracts";
import { apiLogger } from "./lib/logger";
import { isPgliteCheckpointFailure, pgliteRecoverySteps } from "./lib/pglite-recovery-hint";

const pgliteRecoveryHint = (error: unknown, dbPath: string) => {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  if (!isPgliteCheckpointFailure(message)) return null;
  return `PGlite failed to open ${dbPath}. ${pgliteRecoverySteps(dbPath)}.`;
};

export const openAppDatabase = async (path: string, lifecycle: AppLifecycle = {}) => {
  try {
    return await createDb({ path, onLockAcquired: lifecycle.onDatabaseLockAcquired });
  } catch (err) {
    const hint = pgliteRecoveryHint(err, path);
    apiLogger.error({ dataDir: path, err, event: "db.open.failed", hint }, hint ?? "PGlite database failed to open");
    if (!hint) throw err;
    throw new Error(hint, { cause: err });
  }
};

export const createAppDatabaseServices = (db: DbClient) => ({
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
  projectTemplateDefaultsDBService: createProjectTemplateDefaultsDBService(db),
});
