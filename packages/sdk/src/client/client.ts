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
  /** @deprecated Legacy core ticket client. Ticket data is owned by the pstdio tickets extension. */
  tickets: TicketClient;
  workspaces: WorkspaceClient;
  sessions: SessionClient;
  /** @deprecated Legacy core ticket status client. Ticket statuses are owned by the pstdio tickets extension. */
  statuses: StatusClient;
  /** @deprecated Legacy core ticket tag client. Ticket tags are owned by the pstdio tickets extension. */
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
    /** @deprecated Legacy core ticket client. Ticket data is owned by the pstdio tickets extension. */
    tickets: createTicketClient(request, options),
    workspaces: createWorkspaceClient(request),
    sessions: createSessionClient(request, options),
    /** @deprecated Legacy core ticket status client. Ticket statuses are owned by the pstdio tickets extension. */
    statuses: createStatusClient(request),
    /** @deprecated Legacy core ticket tag client. Ticket tags are owned by the pstdio tickets extension. */
    tags: createTagClient(request),
    templates: createTemplateClient(request),
    skills: createSkillClient(request),
    agents: createAgentClient(request),
    extensions: createExtensionClient(request),
    settings: createSettingsClient(request),
    sync: createSyncClient(options),
  };
};
