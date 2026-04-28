import { type ActionClient, createActionClient } from "./actions";
import { createExtensionCommandClient, type ExtensionCommandClient } from "./extension-commands";
import { createExtensionClient, type ExtensionClient } from "./extensions";
import { createHarnessClient, type HarnessClient } from "./harnesses";
import { createProjectClient, type ProjectClient } from "./projects";
import type { ClientOptions } from "./request";
import { createRequest } from "./request";
import { createSessionClient, type SessionClient } from "./sessions";
import { createSkillClient, type SkillClient } from "./skills";
import { createStatusClient, type StatusClient } from "./statuses";
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
  harnesses: HarnessClient;
  actions: ActionClient;
  extensionCommands: ExtensionCommandClient;
  extensions: ExtensionClient;
};

export const createClient = (options: ClientOptions = {}): PstdioClient => {
  const request = createRequest(options);
  return {
    projects: createProjectClient(request),
    tickets: createTicketClient(request),
    workspaces: createWorkspaceClient(request),
    sessions: createSessionClient(request),
    statuses: createStatusClient(request),
    tags: createTagClient(request),
    templates: createTemplateClient(request),
    skills: createSkillClient(request),
    harnesses: createHarnessClient(request),
    actions: createActionClient(request),
    extensionCommands: createExtensionCommandClient(request),
    extensions: createExtensionClient(request),
  };
};
