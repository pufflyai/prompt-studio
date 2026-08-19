import type { ExtensionTerminalApi } from "pstdio-api-contracts/extension-kernel";
import type {
  createActivityEventsDBService,
  createExtensionAutomationPreferencesDBService,
  createExtensionInstancesDBService,
  createExtensionSettingsDBService,
  createExtensionStorageDBService,
  createInstalledExtensionSourcesDBService,
  createNotificationsDBService,
  createSessionQueueEntriesDBService,
} from "pstdio-db";
import type { createExtensionFileService } from "../services/extension-file-service";
import type { createExtensionService } from "../services/extension-service";
import type { createFileService } from "../services/file-service";
import type { createNotificationService } from "../services/notification-service";
import type { createProjectService } from "../services/project-service";
import type { createRepoService } from "../services/repo-service";
import type { createSessionService } from "../services/session-service";
import type { createSettingsService } from "../services/settings-service";
import type { createSkillService } from "../services/skill-service";
import type { createSyncService } from "../services/sync-service";
import type { createTemplateService } from "../services/template-service";
import type { createWorkspaceService } from "../services/workspace-service";
import type { createWorkspaceSessionService } from "../services/workspace-session-service";
import type { createExtensionSettingsService } from "./extensions/extension-settings-service";
import type { ExtensionWebviewAccess } from "./extensions/extension-webview-access";
import type { ProjectExtensionRuntimeCatalog } from "./extensions/project-extension-runtime-catalog";
import type { HarnessRegistryService } from "./harnesses/harness-registry-service";
import type { RuntimeRouteDeps } from "./runtime/routes";
import type { EventBus } from "./sync/event-bus";

export interface ReadinessChecks {
  database: boolean;
  storage: boolean;
}

// Master container for the API's services. Per-feature subsets live in
// `features/<name>/deps.ts` as Pick<RouteDeps, ...> aliases. Route factories
// and handlers should accept the narrow per-feature deps so adding a service
// here does not silently widen every feature's surface.
export interface RouteDeps {
  filesRoot: string;
  extensionWebviewAccess: ExtensionWebviewAccess;
  readiness: ReadinessChecks;
  closeDb: () => Promise<void>;
  eventBus: EventBus;
  harnessRegistry: HarnessRegistryService;
  projectService: ReturnType<typeof createProjectService>;
  repoService: ReturnType<typeof createRepoService>;
  sessionService: ReturnType<typeof createSessionService>;
  sessionQueueEntriesService: ReturnType<typeof createSessionQueueEntriesDBService>;
  settingsService: ReturnType<typeof createSettingsService>;
  workspaceService: ReturnType<typeof createWorkspaceService>;
  workspaceSessionService: ReturnType<typeof createWorkspaceSessionService>;
  templateService: ReturnType<typeof createTemplateService>;
  skillService: ReturnType<typeof createSkillService>;
  fileService: ReturnType<typeof createFileService>;
  notificationsDbService: ReturnType<typeof createNotificationsDBService>;
  notificationService: ReturnType<typeof createNotificationService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
  extensionAutomationPreferencesService: ReturnType<typeof createExtensionAutomationPreferencesDBService>;
  extensionFileService: ReturnType<typeof createExtensionFileService>;
  extensionSettingsDBService: ReturnType<typeof createExtensionSettingsDBService>;
  extensionService: ReturnType<typeof createExtensionService>;
  extensionRuntimeCatalog: ProjectExtensionRuntimeCatalog;
  extensionSettingsService: ReturnType<typeof createExtensionSettingsService>;
  extensionStorageService: ReturnType<typeof createExtensionStorageDBService>;
  syncService: ReturnType<typeof createSyncService>;
  activityEventsService: ReturnType<typeof createActivityEventsDBService>;
  /** Host PTY supervisor api; owned by the app runtime, disposed on app close. */
  terminal?: ExtensionTerminalApi;
  runtime?: RuntimeRouteDeps;
}
