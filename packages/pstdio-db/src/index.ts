export { and, eq, sql } from "drizzle-orm";
export type { DbClient } from "./db/connection.pglite";
export { createDb } from "./db/connection.pglite";
export { resolveDbPath } from "./db/paths";

export * from "./db/schemas.pg";
export * from "./db/schemas.zod";
export { createActivityEventsDBService } from "./services/activity-events/activity-events";
export { createAgentConfigsDBService } from "./services/agent-configs/agent-configs";
export { createAttemptStatusesDBService } from "./services/attempt-statuses/attempt-statuses";
export type { ValidColor } from "./services/colors";
export { isValidColor, VALID_COLORS } from "./services/colors";
export { createExtensionInstancesDBService } from "./services/extension-instances/extension-instances";
export {
  createExtensionSkillPreferencesDBService,
  createExtensionTemplatePreferencesDBService,
} from "./services/extension-preferences/extension-preferences";
export { createExtensionStorageDBService } from "./services/extension-storage/extension-storage";
export { createFilesDBService } from "./services/files/files";
export { createInstalledExtensionSourcesDBService } from "./services/installed-extension-sources/installed-extension-sources";
export { createProjectTemplateDefaultsDBService } from "./services/project-template-defaults/project-template-defaults";
export { createProjectsDBService } from "./services/projects/projects";
export { createReposDBService } from "./services/repos/repos";
export { createSessionsDBService } from "./services/sessions/sessions";
export { createSkillsDBService } from "./services/skills/skills";
export { createStatusesDBService } from "./services/statuses/statuses";
export { createTagsDBService } from "./services/tags/tags";
export { createTemplatesDBService } from "./services/templates/templates";
export { createTicketsDBService } from "./services/tickets/tickets";
export { createWorkspaceArtifactsDBService } from "./services/workspace-artifacts/workspace-artifacts";
export { createWorkspaceSessionsDBService } from "./services/workspace-sessions/workspace-sessions";
export { createWorkspacesDBService } from "./services/workspaces/workspaces";
