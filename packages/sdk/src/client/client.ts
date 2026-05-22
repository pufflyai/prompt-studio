import { type AgentClient, createAgentClient } from "./agents";
import { createExtensionClient, type ExtensionClient } from "./extensions";
import { createProjectClient, type ProjectClient } from "./projects";
import type { ClientOptions } from "./request";
import { createRequest } from "./request";
import { createSessionClient, type SessionClient } from "./sessions";
import { createSettingsClient, type SettingsClient } from "./settings";
import { createSkillClient, type SkillClient } from "./skills";
import { createStatusClient, type StatusClient } from "./statuses";
import { createSyncClient, type SyncClient } from "./sync";
import { createTagClient, type TagClient } from "./tags";
import { createTemplateClient, type TemplateClient } from "./templates";
import { createTicketClient, type TicketClient } from "./tickets";
import { createWorkspaceClient, type WorkspaceClient } from "./workspaces";

export type PstdioClient = {
  projects: ProjectClient;
  tickets: TicketClient;
  workspaces: WorkspaceClient;
  sessions: SessionClient;
  statuses: StatusClient;
  tags: TagClient;
  templates: TemplateClient;
  skills: SkillClient;
  agents: AgentClient;
  extensions: ExtensionClient;
  settings: SettingsClient;
  sync: SyncClient;
};

export const createClient = (options: ClientOptions = {}): PstdioClient => {
  const request = createRequest(options);
  return {
    projects: createProjectClient(request),
    tickets: createTicketClient(request, options),
    workspaces: createWorkspaceClient(request),
    sessions: createSessionClient(request, options),
    statuses: createStatusClient(request),
    tags: createTagClient(request),
    templates: createTemplateClient(request),
    skills: createSkillClient(request),
    agents: createAgentClient(request),
    extensions: createExtensionClient(request),
    settings: createSettingsClient(request),
    sync: createSyncClient(options),
  };
};
