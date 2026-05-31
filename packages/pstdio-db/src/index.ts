export { and, eq, sql } from "drizzle-orm";
export type { DbClient } from "./db/connection.pglite";
export { createDb } from "./db/connection.pglite";
export { resolveDbPath } from "./db/paths";

export * from "./db/schemas.pg";
export * from "./db/schemas.zod";
export { createActivityEventsDBService } from "./services/activity-events/activity-events";
export { createAgentConfigsDBService } from "./services/agent-configs/agent-configs";
/** @deprecated Legacy core ticket attempt status DB service. Workspace status automation is extension-owned. */
export { createAttemptStatusesDBService } from "./services/attempt-statuses/attempt-statuses";
export type { ValidColor } from "./services/colors";
export { isValidColor, VALID_COLORS } from "./services/colors";
export { createExtensionInstancesDBService } from "./services/extension-instances/extension-instances";
export {
  createExtensionSkillPreferencesDBService,
  createExtensionTemplatePreferencesDBService,
} from "./services/extension-preferences/extension-preferences";
export {
  createExtensionSettingsDBService,
  type ExtensionSettingOwnerType,
} from "./services/extension-settings/extension-settings";
export { createExtensionStorageDBService } from "./services/extension-storage/extension-storage";
export { createFilesDBService } from "./services/files/files";
export { createInstalledExtensionSourcesDBService } from "./services/installed-extension-sources/installed-extension-sources";
export { createProjectTemplateDefaultsDBService } from "./services/project-template-defaults/project-template-defaults";
export { createProjectsDBService } from "./services/projects/projects";
export { createReposDBService } from "./services/repos/repos";
export { createSessionQueueEntriesDBService } from "./services/session-queue-entries/session-queue-entries";
export { createSessionsDBService } from "./services/sessions/sessions";
export { createSettingsDBService } from "./services/settings/settings";
export { createSkillsDBService } from "./services/skills/skills";
/** @deprecated Legacy core ticket status DB service. Ticket statuses are owned by the pstdio tickets extension. */
export { createStatusesDBService } from "./services/statuses/statuses";
/** @deprecated Legacy core ticket tag DB service. Ticket tags are owned by the pstdio tickets extension. */
export { createTagsDBService } from "./services/tags/tags";
export { createTemplatesDBService } from "./services/templates/templates";
/** @deprecated Legacy core ticket DB service. Ticket data is owned by the pstdio tickets extension. */
export { createTicketsDBService } from "./services/tickets/tickets";
/** @deprecated Legacy ticket artifact DB service. Ticket artifacts are owned by the pstdio tickets extension. */
export { createWorkspaceArtifactsDBService } from "./services/workspace-artifacts/workspace-artifacts";
export { createWorkspaceSessionsDBService } from "./services/workspace-sessions/workspace-sessions";
export { createWorkspacesDBService } from "./services/workspaces/workspaces";
