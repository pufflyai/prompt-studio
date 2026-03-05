import type { AgentRegistry } from "pstdio-agents";
import type {
  createAgentConfigsService,
  createProjectsService,
  createReposService,
  createTemplatesService,
  createTicketsService,
  createWorkspacesService,
  DbClient,
} from "pstdio-db";
import type { createFilesService, createSkillsService } from "pstdio-storage";

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
  templatesService: ReturnType<typeof createTemplatesService>;
  ticketsService: ReturnType<typeof createTicketsService>;
  workspacesService: ReturnType<typeof createWorkspacesService>;
  agentRegistry: AgentRegistry;
}
