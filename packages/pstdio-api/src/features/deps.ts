import type { AgentRegistry } from "pstdio-agents";
import type {
  createAgentConfigsService,
  createProjectsService,
  createReposService,
  createSessionsService,
  createSkillsDbService,
  createStatusesService,
  createTagsService,
  createTemplatesService,
  createTicketsService,
  createWorkspaceSessionsService,
  createWorkspacesService,
  DbClient,
} from "pstdio-db";
import type { createDocsService, createFilesService, createSkillsService } from "pstdio-storage";
import type { SessionStore } from "./sessions/session-store";

import type { EventBus } from "./sync/event-bus";

export interface ReadinessChecks {
  database: boolean;
  storage: boolean;
}

export interface RouteDeps {
  readiness: ReadinessChecks;
  db: DbClient;
  closeDb: () => Promise<void>;
  eventBus: EventBus;
  projectsService: ReturnType<typeof createProjectsService>;
  reposService: ReturnType<typeof createReposService>;
  agentConfigsService: ReturnType<typeof createAgentConfigsService>;
  filesService: ReturnType<typeof createFilesService>;
  skillsService: ReturnType<typeof createSkillsService>;
  skillsDbService: ReturnType<typeof createSkillsDbService>;
  templatesService: ReturnType<typeof createTemplatesService>;
  ticketsService: ReturnType<typeof createTicketsService>;
  workspacesService: ReturnType<typeof createWorkspacesService>;
  workspaceSessionsService: ReturnType<typeof createWorkspaceSessionsService>;
  sessionsService: ReturnType<typeof createSessionsService>;
  statusesService: ReturnType<typeof createStatusesService>;
  tagsService: ReturnType<typeof createTagsService>;
  docsService: ReturnType<typeof createDocsService>;
  agentRegistry: AgentRegistry;
  sessionStore: SessionStore;
}
