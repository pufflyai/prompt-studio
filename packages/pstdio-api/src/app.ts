import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sessionEvents, ticketEvents } from "@pstdio/sdk/extensions";
import { type AgentService, createAgentRegistry, resolveDefaultAgents } from "pstdio-agents";
import {
  createActivityEventsDBService,
  createAgentConfigsDBService,
  createAttemptStatusesDBService,
  createDb,
  createExtensionInstancesDBService,
  createExtensionSettingsDBService,
  createExtensionSkillPreferencesDBService,
  createExtensionStorageDBService,
  createExtensionTemplatePreferencesDBService,
  createFilesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
  createProjectTemplateDefaultsDBService,
  createReposDBService,
  createSessionQueueEntriesDBService,
  createSessionsDBService,
  createSettingsDBService,
  createSkillsDBService,
  createStatusesDBService,
  createTagsDBService,
  createTemplatesDBService,
  createTicketsDBService,
  createWorkspaceArtifactsDBService,
  createWorkspaceSessionsDBService,
  createWorkspacesDBService,
} from "pstdio-db";
import {
  createFilesStorageService,
  createSkillsStorageService,
  ensureStorageRoot,
  resolveStorageRoot,
} from "pstdio-storage";
import { registerApi } from "./app-routing";
import type { RouteDeps } from "./features/deps";
import { fireExtensionEventAsync } from "./features/extensions/extension-event-runtime";
import { createExtensionScheduler } from "./features/extensions/extension-scheduler";
import { createExtensionSettingsService } from "./features/extensions/extension-settings-service";
import { createInstalledExtensionRuntime } from "./features/extensions/installed-extension-runtime";
import { fireSessionLifecycleEventAsync } from "./features/hooks/session-hooks";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import { EventBus } from "./features/sync/event-bus";
import { apiLogger } from "./lib/logger";
import { createAgentConfigService } from "./services/agent-config-service";
import { createAttemptStatusService } from "./services/attempt-status-service";
import { createExtensionService } from "./services/extension-service";
import { createFileService } from "./services/file-service";
import { createProjectService } from "./services/project-service";
import { createRepoService } from "./services/repo-service";
import { createSessionService } from "./services/session-service";
import { createSettingsService } from "./services/settings-service";
import { createSkillService } from "./services/skill-service";
import { createStatusService } from "./services/status-service";
import { createSyncService } from "./services/sync-service";
import { createTagService } from "./services/tag-service";
import { createTemplateService } from "./services/template-service";
import { createTicketService } from "./services/ticket-service";
import { createWorkspaceArtifactService } from "./services/workspace-artifact-service";
import { createWorkspaceService } from "./services/workspace-service";
import { createWorkspaceSessionService } from "./services/workspace-session-service";
import { runStartupTasks } from "./startup";
import type { AppBindings } from "./types";

const EXTENSION_SCHEDULE_WATERMARK_FILE = "extension-schedule-watermarks.json";

interface AppOptions {
  dbPath?: string;
  storagePath?: string;
  filesRoot: string;
  apiToken?: string;
  agents?: AgentService[];
  eventBusBufferSize?: number;
  extensionWebviewBuilds?: boolean;
}

const resolveEventBusBufferSize = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return Math.floor(parsed);
};

const resolveExtensionWebviewBuilds = (value: boolean | undefined) => {
  if (value !== undefined) return value;
  return process.env.PSTDIO_EXTENSION_WEBVIEW_BUILDS !== "0";
};

const sessionStatusEventFor = (status: string) => {
  if (status === "awaiting_input") return sessionEvents.awaitingInput;
  if (status === "completed") return sessionEvents.succeeded;
  if (status === "failed") return sessionEvents.failed;
  return null;
};

export const createApp = async (options: AppOptions) => {
  const { db, close: closeDb } = await createDb({ path: options?.dbPath ?? process.env.PSTDIO_DB_PATH });
  const apiToken = options?.apiToken ?? process.env.PSTDIO_API_TOKEN;
  const app = new OpenAPIHono<AppBindings>();

  const storageRoot = options?.storagePath ?? resolveStorageRoot(process.env.PSTDIO_STORAGE_PATH);
  ensureStorageRoot(storageRoot);

  // --- db services ---
  const projectsDBService = createProjectsDBService(db);
  const reposDBService = createReposDBService(db);
  const sessionQueueEntriesService = createSessionQueueEntriesDBService(db);
  const sessionsDBService = createSessionsDBService(db);
  const settingsDBService = createSettingsDBService(db);
  const ticketsDBService = createTicketsDBService(db);
  const workspacesDBService = createWorkspacesDBService(db);
  const workspaceArtifactsDBService = createWorkspaceArtifactsDBService(db);
  const workspaceSessionsDBService = createWorkspaceSessionsDBService(db);
  const statusesDBService = createStatusesDBService(db);
  const attemptStatusesDBService = createAttemptStatusesDBService(db);
  const tagsDBService = createTagsDBService(db);
  const agentConfigsDBService = createAgentConfigsDBService(db);
  const skillsDBService = createSkillsDBService(db);
  const templatesDBService = createTemplatesDBService(db);
  const filesDBService = createFilesDBService(db);
  const activityEventsService = createActivityEventsDBService(db);
  const installedExtensionSourcesService = createInstalledExtensionSourcesDBService(db);
  const extensionInstancesService = createExtensionInstancesDBService(db);
  const extensionTemplatePreferencesDBService = createExtensionTemplatePreferencesDBService(db);
  const extensionSkillPreferencesDBService = createExtensionSkillPreferencesDBService(db);
  const projectTemplateDefaultsDBService = createProjectTemplateDefaultsDBService(db);
  const extensionStorageService = createExtensionStorageDBService(db);
  const extensionSettingsDBService = createExtensionSettingsDBService(db);

  // --- storage services ---
  const filesStorageService = createFilesStorageService(storageRoot);
  const skillsStorageService = createSkillsStorageService();

  // --- infrastructure ---
  const eventBus = new EventBus({
    bufferSize: options.eventBusBufferSize ?? resolveEventBusBufferSize(process.env.PSTDIO_EVENT_BUS_BUFFER_SIZE),
  });
  const agentRegistry = createAgentRegistry(resolveDefaultAgents(options?.agents));

  // --- domain services ---
  const projectService = createProjectService({ projectsDBService });
  const repoService = createRepoService({ reposDBService });
  const statusService = createStatusService({ statusesDBService });
  const tagService = createTagService({ tagsDBService });
  const attemptStatusService = createAttemptStatusService({ attemptStatusesDBService });
  const agentConfigService = createAgentConfigService({ agentConfigsDBService });
  const fileService = createFileService({ filesDBService, filesStorageService });
  const syncService = createSyncService({ db, eventBus });
  let refreshInstalledExtensionProcesses: () => Promise<void> = async () => {};
  let closeApp: () => Promise<void> = async () => {};
  const extensionService = createExtensionService({
    extensionInstancesService,
    installedExtensionSourcesService,
    eventBus,
    onInstalledSourcesChanged: () => refreshInstalledExtensionProcesses(),
    projectService,
  });
  const extensionSettingsService = createExtensionSettingsService({ extensionSettingsDBService });
  const extensionRuntime = await createInstalledExtensionRuntime({
    agentConfigService,
    extensionService,
    installedExtensionSourcesService,
    projectService,
    repoService,
    webviewBuilds: resolveExtensionWebviewBuilds(options.extensionWebviewBuilds),
  });
  refreshInstalledExtensionProcesses = extensionRuntime.refresh;
  const templateService = createTemplateService({
    extensionService,
    extensionTemplatePreferencesDBService,
    fileService,
    projectTemplateDefaultsDBService,
    templatesDBService,
  });
  const skillService = createSkillService({
    extensionService,
    extensionSkillPreferencesDBService,
    fileService,
    skillsDBService,
    skillsStorageService,
  });

  const workspaceSessionService = createWorkspaceSessionService({ workspaceSessionsDBService });
  const workspaceArtifactService = createWorkspaceArtifactService({ workspaceArtifactsDBService });
  const workspaceService = createWorkspaceService({ workspacesDb: workspacesDBService, eventBus });
  const ticketService = createTicketService({
    ticketsDb: ticketsDBService,
    eventBus,
    onPostTicketDeletion: (projectId, payload) => {
      fireExtensionEventAsync(deps, projectId, ticketEvents.deleted, { projectId, ticket: payload });
    },
  });

  const sessionHookDeps = () => ({
    activityEventsService,
    extensionService,
    extensionSettingsService,
    extensionStorageService,
    fileService,
    repoService,
    sessionQueueEntriesService,
    sessionService,
    settingsService,
    templateService,
    workspaceService,
    workspaceSessionService,
    attemptStatusService,
    statusService,
    ticketService,
  });

  let drainSessionQueue: (input?: { releasedSessionId?: string }) => Promise<void> = async () => {};

  const sessionService = createSessionService({
    sessionsDb: sessionsDBService,
    sessionQueueEntriesService,
    eventBus,
    onSessionStarted: (session) => {
      fireSessionLifecycleEventAsync(sessionHookDeps(), sessionEvents.started, session);
    },
    onSessionStatusChanged: (session) => {
      const event = sessionStatusEventFor(session.status);
      if (event) {
        fireSessionLifecycleEventAsync(sessionHookDeps(), event, session);
      }
    },
    onSessionResumed: (session) => {
      fireSessionLifecycleEventAsync(sessionHookDeps(), sessionEvents.resumed, session);
    },
    onCapacityAvailable: (input) => drainSessionQueue(input),
  });
  const settingsService = createSettingsService({
    settingsDb: settingsDBService,
    onCapacityAvailable: () => drainSessionQueue(),
  });

  // --- ONLY DOMAIN SERVICES ARE PASSED TO ROUTES ---
  const deps: RouteDeps = {
    filesRoot: options.filesRoot,
    readiness: { database: true, storage: true },
    closeDb,
    shutdown: () => closeApp(),
    eventBus,
    agentRegistry,
    projectService,
    repoService,
    sessionQueueEntriesService,
    sessionService,
    settingsService,
    ticketService,
    workspaceService,
    workspaceArtifactService,
    workspaceSessionService,
    statusService,
    tagService,
    templateService,
    attemptStatusService,
    agentConfigService,
    skillService,
    fileService,
    installedExtensionSourcesService,
    extensionService,
    extensionSettingsService,
    extensionStorageService,
    syncService,
    activityEventsService,
  };

  const extensionScheduler = createExtensionScheduler({
    deps,
    listProjectIds: async () => (await projectService.list()).map((project) => project.id),
    watermarkPath: join(storageRoot, EXTENSION_SCHEDULE_WATERMARK_FILE),
  });

  drainSessionQueue = async (input) => {
    await createSessionScheduler(deps).drainQueue(input);
  };

  registerApi(app, deps, { apiToken });

  const startupAbort = new AbortController();
  const startupDone = runStartupTasks(deps, startupAbort.signal, {
    recoverQueuedSessions: () => createSessionScheduler(deps).recoverQueuedSessions(),
  }).catch((err) => apiLogger.error({ err, event: "api.startup.error" }, "Startup task failed"));

  let closePromise: Promise<void> | null = null;
  const close = async () => {
    closePromise ??= (async () => {
      startupAbort.abort();
      await startupDone;
      extensionRuntime.dispose();
      await extensionScheduler.dispose();
      await closeDb();
    })();

    await closePromise;
  };
  closeApp = close;

  return { app, close, deps, eventBus };
};
