import type { AgentRegistry } from "pstdio-agents";
import type { createAgentConfigService } from "../services/agent-config-service";
import type { createAttemptStatusService } from "../services/attempt-status-service";
import type { createExtensionCommandService } from "../services/extension-command-service";
import type { createExtensionInstanceService } from "../services/extension-instance-service";
import type { createExtensionStorageService } from "../services/extension-storage-service";
import type { createFileService } from "../services/file-service";
import type { createHarnessProviderService } from "../services/harness-provider-service";
import type { createProjectService } from "../services/project-service";
import type { createRepoService } from "../services/repo-service";
import type { createSessionService } from "../services/session-service";
import type { createSkillService } from "../services/skill-service";
import type { createSyncService } from "../services/sync-service";
import type { createTemplateService } from "../services/template-service";
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
  workspaceService: ReturnType<typeof createWorkspaceService>;
  workspaceSessionService: ReturnType<typeof createWorkspaceSessionService>;
  templateService: ReturnType<typeof createTemplateService>;
  attemptStatusService: ReturnType<typeof createAttemptStatusService>;
  agentConfigService: ReturnType<typeof createAgentConfigService>;
  extensionInstanceService: ReturnType<typeof createExtensionInstanceService>;
  extensionStorageService: ReturnType<typeof createExtensionStorageService>;
  skillService: ReturnType<typeof createSkillService>;
  fileService: ReturnType<typeof createFileService>;
  harnessProviderService: ReturnType<typeof createHarnessProviderService>;
  syncService: ReturnType<typeof createSyncService>;
  pluginService: ReturnType<typeof createPluginService>;
  extensionCommandService: ReturnType<typeof createExtensionCommandService>;
}
