import type { AgentRegistry } from "pstdio-agents";
import type { createActivityEventsDBService } from "pstdio-db";
import type { createAgentConfigService } from "../services/agent-config-service";
import type { createAttemptStatusService } from "../services/attempt-status-service";
import type { createFileService } from "../services/file-service";
import type { createProjectService } from "../services/project-service";
import type { createRepoService } from "../services/repo-service";
import type { createSessionService } from "../services/session-service";
import type { createSkillService } from "../services/skill-service";
import type { createStatusService } from "../services/status-service";
import type { createSyncService } from "../services/sync-service";
import type { createTagService } from "../services/tag-service";
import type { createTemplateService } from "../services/template-service";
import type { createTicketService } from "../services/ticket-service";
import type { createWorkspaceArtifactService } from "../services/workspace-artifact-service";
import type { createWorkspaceService } from "../services/workspace-service";
import type { createWorkspaceSessionService } from "../services/workspace-session-service";
import type { createPluginService } from "./plugins/plugin-service";
import type { EventBus } from "./sync/event-bus";

export interface ReadinessChecks {
  database: boolean;
  storage: boolean;
}

export interface RouteDeps {
  filesRoot: string;
  readiness: ReadinessChecks;
  closeDb: () => Promise<void>;
  eventBus: EventBus;
  agentRegistry: AgentRegistry;
  projectService: ReturnType<typeof createProjectService>;
  repoService: ReturnType<typeof createRepoService>;
  sessionService: ReturnType<typeof createSessionService>;
  ticketService: ReturnType<typeof createTicketService>;
  workspaceService: ReturnType<typeof createWorkspaceService>;
  workspaceArtifactService: ReturnType<typeof createWorkspaceArtifactService>;
  workspaceSessionService: ReturnType<typeof createWorkspaceSessionService>;
  statusService: ReturnType<typeof createStatusService>;
  tagService: ReturnType<typeof createTagService>;
  templateService: ReturnType<typeof createTemplateService>;
  attemptStatusService: ReturnType<typeof createAttemptStatusService>;
  agentConfigService: ReturnType<typeof createAgentConfigService>;
  skillService: ReturnType<typeof createSkillService>;
  fileService: ReturnType<typeof createFileService>;
  syncService: ReturnType<typeof createSyncService>;
  pluginService: ReturnType<typeof createPluginService>;
  activityEventsService: ReturnType<typeof createActivityEventsDBService>;
}
