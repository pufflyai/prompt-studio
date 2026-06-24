import { type AgentClient, createAgentClient } from "./agents";
import { createExtensionClient, type ExtensionClient } from "./extensions";
import { createNotificationsClient, type NotificationsClient } from "./notifications";
import { createProjectClient, type ProjectClient } from "./projects";
import type { ClientOptions } from "./request";
import { createRequest } from "./request";
import { createSessionClient, type SessionClient } from "./sessions";
import { createSettingsClient, type SettingsClient } from "./settings";
import { createSkillClient, type SkillClient } from "./skills";
import { createSyncClient, type SyncClient } from "./sync";
import { createTemplateClient, type TemplateClient } from "./templates";
import { createWorkspaceClient, type WorkspaceClient } from "./workspaces";

export type PstdioClient = {
  projects: ProjectClient;
  workspaces: WorkspaceClient;
  sessions: SessionClient;
  templates: TemplateClient;
  skills: SkillClient;
  agents: AgentClient;
  notifications: NotificationsClient;
  extensions: ExtensionClient;
  settings: SettingsClient;
  sync: SyncClient;
};

export const createClient = (options: ClientOptions = {}): PstdioClient => {
  const request = createRequest(options);
  return {
    projects: createProjectClient(request),
    workspaces: createWorkspaceClient(request),
    sessions: createSessionClient(request, options),
    templates: createTemplateClient(request),
    skills: createSkillClient(request),
    agents: createAgentClient(request),
    notifications: createNotificationsClient(request),
    extensions: createExtensionClient(request),
    settings: createSettingsClient(request),
    sync: createSyncClient(options),
  };
};
