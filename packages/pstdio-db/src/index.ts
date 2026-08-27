export { and, eq, sql } from "drizzle-orm";
export type { DbClient } from "./db/connection.pglite";
export { createDb } from "./db/connection.pglite";
export { legacyTemplateOwnerSourcePath } from "./db/legacy-template-migration";
export { resolveDbPath } from "./db/paths";

export * from "./db/schemas.pg";
export * from "./db/schemas.zod";
export { createActivityEventsDBService } from "./services/activity-events/activity-events";
export { createAutomationDBService } from "./services/automation/automation";
export type { ValidColor } from "./services/colors";
export { isValidColor, VALID_COLORS } from "./services/colors";
export { createExtensionConnectionsDBService } from "./services/extension-connections/extension-connections";
export { createExtensionFilesDBService } from "./services/extension-files/extension-files";
export { createExtensionInstancesDBService } from "./services/extension-instances/extension-instances";
export { createExtensionAutomationPreferencesDBService } from "./services/extension-preferences/automation-preferences";
export { createExtensionSkillPreferencesDBService } from "./services/extension-preferences/extension-preferences";
export {
  createExtensionSettingsDBService,
  type ExtensionSettingOwnerType,
} from "./services/extension-settings/extension-settings";
export { createExtensionStorageDBService } from "./services/extension-storage/extension-storage";
export { createExtensionUserDataDBService } from "./services/extension-user-data/extension-user-data";
export { createFilesDBService } from "./services/files/files";
export { createInstalledExtensionSourcesDBService } from "./services/installed-extension-sources/installed-extension-sources";
export { createNotificationsDBService } from "./services/notifications/notifications";
export { createProjectsDBService } from "./services/projects/projects";
export { createReposDBService } from "./services/repos/repos";
export { createSessionQueueEntriesDBService } from "./services/session-queue-entries/session-queue-entries";
export { createSessionsDBService } from "./services/sessions/sessions";
export { createSettingsDBService } from "./services/settings/settings";
export { createSkillsDBService } from "./services/skills/skills";
export { createWorkspaceSessionsDBService } from "./services/workspace-sessions/workspace-sessions";
export {
  WorkspaceNameConflictError,
  WorkspaceNameValidationError,
  WorkspaceNotRenameableError,
  workspaceNameMaxLength,
} from "./services/workspaces/rename-workspace";
export { createWorkspacesDBService } from "./services/workspaces/workspaces";
