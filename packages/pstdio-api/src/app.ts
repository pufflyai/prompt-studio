import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sessionEvents } from "pstdio-api-contracts/extension-kernel";
import {
  createActivityEventsDBService,
  createDb,
  createExtensionFilesDBService,
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
  createTemplatesDBService,
  createWorkspaceSessionsDBService,
  createWorkspacesDBService,
} from "pstdio-db";
import { createFilesStorageService, ensureStorageRoot, resolveStorageRoot } from "pstdio-storage";
import { registerApi } from "./app-routing";
import type { RouteDeps } from "./features/deps";
import { createExtensionScheduler } from "./features/extensions/extension-scheduler";
import { createExtensionSettingsService } from "./features/extensions/extension-settings-service";
import { createInstalledExtensionRuntime } from "./features/extensions/installed-extension-runtime";
import { subscribeRepoLinkExtensionRefresh } from "./features/extensions/repo-link-extension-refresh";
import {
  createHarnessRegistryService,
  type HarnessRegistryService,
} from "./features/harnesses/harness-registry-service";
import { fireSessionLifecycleEventAsync } from "./features/hooks/session-hooks";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import { EventBus } from "./features/sync/event-bus";
import { apiLogger } from "./lib/logger";
import { createExtensionService } from "./services/extension-service";
import { createFileService } from "./services/file-service";
import { createProjectService } from "./services/project-service";
import { createRepoService } from "./services/repo-service";
import { createSessionService } from "./services/session-service";
import { createSettingsService } from "./services/settings-service";
import { createSkillService } from "./services/skill-service";
import { createSyncService } from "./services/sync-service";
import { createTemplateService } from "./services/template-service";
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
  eventBusBufferSize?: number;
  extensionWebviewBuilds?: boolean;
  /** Test seam: overrides the extension-backed harness registry. */
  harnessRegistry?: HarnessRegistryService;
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
  const workspacesDBService = createWorkspacesDBService(db);
  const workspaceSessionsDBService = createWorkspaceSessionsDBService(db);
  const skillsDBService = createSkillsDBService(db);
  const templatesDBService = createTemplatesDBService(db);
  const filesDBService = createFilesDBService(db);
  const activityEventsService = createActivityEventsDBService(db);
  const installedExtensionSourcesService = createInstalledExtensionSourcesDBService(db);
  const extensionInstancesService = createExtensionInstancesDBService(db);
  const extensionFilesService = createExtensionFilesDBService(db);
  const extensionTemplatePreferencesDBService = createExtensionTemplatePreferencesDBService(db);
  const extensionSkillPreferencesDBService = createExtensionSkillPreferencesDBService(db);
  const projectTemplateDefaultsDBService = createProjectTemplateDefaultsDBService(db);
  const extensionStorageService = createExtensionStorageDBService(db);
  const extensionSettingsDBService = createExtensionSettingsDBService(db);

  // --- storage services ---
  const filesStorageService = createFilesStorageService(storageRoot);

  // --- infrastructure ---
  const eventBus = new EventBus({
    bufferSize: options.eventBusBufferSize ?? resolveEventBusBufferSize(process.env.PSTDIO_EVENT_BUS_BUFFER_SIZE),
  });

  // --- domain services ---
  const projectService = createProjectService({ projectsDBService });
  const repoService = createRepoService({ reposDBService });
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
  const harnessRegistry =
    options.harnessRegistry ?? createHarnessRegistryService({ installedExtensionSourcesService, extensionService });
  const extensionRuntime = await createInstalledExtensionRuntime({
    extensionService,
    harnessRegistry,
    installedExtensionSourcesService,
    projectService,
    repoService,
    webviewBuilds: resolveExtensionWebviewBuilds(options.extensionWebviewBuilds),
  });
  refreshInstalledExtensionProcesses = extensionRuntime.refresh;
  const unsubscribeRepoLinkRefresh = subscribeRepoLinkExtensionRefresh({
    eventBus,
    refresh: () => extensionRuntime.refresh(),
    onError: (err) =>
      apiLogger.error(
        { err, event: "extensions.repo_link_refresh.error" },
        "Failed to refresh extensions after repo link change",
      ),
  });
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
  });

  const workspaceSessionService = createWorkspaceSessionService({ workspaceSessionsDBService });
  const workspaceService = createWorkspaceService({ workspacesDb: workspacesDBService, eventBus });

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
    harnessRegistry,
    projectService,
    repoService,
    sessionQueueEntriesService,
    sessionService,
    settingsService,
    workspaceService,
    workspaceSessionService,
    templateService,
    skillService,
    fileService,
    installedExtensionSourcesService,
    extensionInstancesService,
    extensionFilesService,
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
      unsubscribeRepoLinkRefresh();
      extensionRuntime.dispose();
      await extensionScheduler.dispose();
      await closeDb();
    })();

    await closePromise;
  };
  closeApp = close;

  return { app, close, deps, eventBus };
};
