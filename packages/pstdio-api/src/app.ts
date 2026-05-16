import { OpenAPIHono } from "@hono/zod-openapi";
import { type AgentService, createAgentRegistry, resolveDefaultAgents } from "pstdio-agents";
import {
  createActivityEventsDBService,
  createAgentConfigsDBService,
  createAttemptStatusesDBService,
  createDb,
  createExtensionInstancesDBService,
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
import { createExtensionSourceWatcher } from "./features/extensions/extension-source-watcher";
import { createExtensionWebviewBuildManager } from "./features/extensions/extension-webview-build-manager";
import { fireSessionResumeHook, fireSessionStartHook, fireSessionStatusHook } from "./features/hooks/session-hooks";
import { fireTicketHook, fireTicketHookAsync } from "./features/hooks/ticket-hooks";
import { createPluginService } from "./features/plugins/plugin-service";
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

interface AppOptions {
  dbPath?: string;
  storagePath?: string;
  filesRoot: string;
  apiToken?: string;
  agents?: AgentService[];
  eventBusBufferSize?: number;
}

const resolveEventBusBufferSize = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return Math.floor(parsed);
};

const createInstalledExtensionRuntime = async (input: {
  extensionService: ReturnType<typeof createExtensionService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
}) => {
  const sourceWatcher = await createExtensionSourceWatcher({
    listInstalledSources: () => input.installedExtensionSourcesService.list(),
    reloadInstalledSource: (installName) => input.extensionService.reloadInstalledSource(installName),
    onError: (err) => apiLogger.error({ err, event: "extensions.source_watcher.error" }, "Extension watcher failed"),
  });
  const webviewBuildManager = createExtensionWebviewBuildManager({
    listInstalledSources: () => input.installedExtensionSourcesService.list(),
    reportBuildFailure: (installName, webviewId, error) =>
      input.extensionService.reportWebviewBuildFailure(installName, webviewId, error),
    reportBuildSuccess: (installName, webviewId) =>
      input.extensionService.reportWebviewBuildSuccess(installName, webviewId),
    onError: (err) =>
      apiLogger.error({ err, event: "extensions.webview_build.error" }, "Extension webview build manager failed"),
  });
  const refresh = async () => {
    await sourceWatcher.refresh();
    await webviewBuildManager.refresh();
  };

  await refresh();

  return {
    dispose: () => {
      sourceWatcher.dispose();
      webviewBuildManager.dispose();
    },
    refresh,
  };
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
  const extensionService = createExtensionService({
    extensionInstancesService,
    installedExtensionSourcesService,
    eventBus,
    onInstalledSourcesChanged: () => refreshInstalledExtensionProcesses(),
    projectService,
  });
  const extensionRuntime = await createInstalledExtensionRuntime({
    extensionService,
    installedExtensionSourcesService,
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
  const pluginClientFetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      return app.request(request);
    },
    { preconnect: globalThis.fetch.preconnect?.bind(globalThis.fetch) },
  ) as typeof fetch;

  const pluginService = createPluginService({
    repoService,
    listProjectIds: async () => (await projectService.list()).map((project) => project.id),
    filesRoot: options.filesRoot,
    storageRoot,
    clientOptions: {
      baseUrl: "http://pstdio.internal",
      fetch: pluginClientFetch,
      token: apiToken,
    },
  });

  const ticketHookDeps = { pluginService };

  const ticketService = createTicketService({
    ticketsDb: ticketsDBService,
    eventBus,
    onPreTicketDeletion: async (projectId, payload) => {
      const result = await fireTicketHook(ticketHookDeps, "preTicketDeletion", projectId, payload);
      return { rejected: result.rejected, error: result.stderr };
    },
    onPostTicketDeletion: (projectId, payload) => {
      fireTicketHookAsync(ticketHookDeps, "postTicketDeletion", projectId, payload);
    },
  });

  const sessionHookDeps = {
    reposService: repoService,
    workspaceSessionsService: workspaceSessionService,
    attemptStatusesService: attemptStatusService,
    statusService,
    ticketService,
    pluginService,
  };

  let drainSessionQueue = async () => {};

  const sessionService = createSessionService({
    sessionsDb: sessionsDBService,
    sessionQueueEntriesService,
    eventBus,
    onSessionStarted: (session) => fireSessionStartHook(sessionHookDeps, session),
    onSessionStatusChanged: (session) => fireSessionStatusHook(sessionHookDeps, session),
    onSessionResumed: (session) => fireSessionResumeHook(sessionHookDeps, session),
    onCapacityAvailable: () => drainSessionQueue(),
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
    extensionService,
    extensionStorageService,
    syncService,
    pluginService,
    activityEventsService,
  };

  drainSessionQueue = async () => {
    await createSessionScheduler(deps).drainQueue();
  };

  registerApi(app, deps, { apiToken });

  const startupAbort = new AbortController();
  const startupDone = runStartupTasks(deps, startupAbort.signal, {
    recoverQueuedSessions: () => createSessionScheduler(deps).recoverQueuedSessions(),
  }).catch((err) => apiLogger.error({ err, event: "api.startup.error" }, "Startup task failed"));

  const close = async () => {
    startupAbort.abort();
    await startupDone;
    extensionRuntime.dispose();
    await pluginService.dispose();
    await closeDb();
  };

  return { app, close, deps, eventBus };
};
