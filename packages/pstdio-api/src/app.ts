import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { websocket } from "hono/bun";
import { sessionEvents } from "pstdio-api-contracts/extension-kernel";
import {
  createActivityEventsDBService,
  createDb,
  createExtensionAutomationPreferencesDBService,
  createExtensionFilesDBService,
  createExtensionInstancesDBService,
  createExtensionSettingsDBService,
  createExtensionSkillPreferencesDBService,
  createExtensionStorageDBService,
  createExtensionTemplatePreferencesDBService,
  createExtensionUserDataDBService,
  createFilesDBService,
  createInstalledExtensionSourcesDBService,
  createNotificationsDBService,
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
  type DbClient,
  resolveDbPath,
} from "pstdio-db";
import { createFilesStorageService, ensureStorageRoot, resolveStorageRoot } from "pstdio-storage";
import { registerApi } from "./app-routing";
import type { RouteDeps } from "./features/deps";
import type { LoadedExtension } from "./features/extensions/extension-runtime";
import { createExtensionScheduler } from "./features/extensions/extension-scheduler";
import { createExtensionSettingsService } from "./features/extensions/extension-settings-service";
import { createTerminalSupervisor } from "./features/extensions/extension-terminal-runtime";
import { createInstalledExtensionRuntime } from "./features/extensions/installed-extension-runtime";
import { subscribeRepoLinkExtensionRefresh } from "./features/extensions/repo-link-extension-refresh";
import {
  createHarnessRegistryService,
  type HarnessRegistryService,
} from "./features/harnesses/harness-registry-service";
import { fireSessionLifecycleEventAsync, type SessionHookDeps } from "./features/hooks/session-hooks";
import type { RuntimeHost } from "./features/runtime/routes";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import { EventBus } from "./features/sync/event-bus";
import { apiLogger } from "./lib/logger";
import { isPgliteCheckpointFailure, pgliteRecoverySteps } from "./lib/pglite-recovery-hint";
import { createExtensionFileService } from "./services/extension-file-service";
import { createExtensionService } from "./services/extension-service";
import { createFileService } from "./services/file-service";
import { createNotificationService } from "./services/notification-service";
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

export const apiWebSocket = websocket;

interface AppOptions {
  dbPath?: string;
  storagePath?: string;
  filesRoot: string;
  apiToken?: string;
  eventBusBufferSize?: number;
  extensionWebviewBuilds?: boolean;
  /** Test seam: overrides the extension-backed harness registry. */
  harnessRegistry?: HarnessRegistryService;
  runtimeHost?: RuntimeHost;
  terminalOrigins?: string[];
  onDatabaseLockAcquired?: () => void;
}

const readTerminalOrigins = () =>
  process.env.PSTDIO_TERMINAL_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

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

// Process-scoped PTY supervisor: every extension command environment shares it,
// and app close force-kills any session still live. Logs lifecycle only.
const createAppTerminalSupervisor = () =>
  createTerminalSupervisor({
    logger: {
      info: (message, metadata) =>
        apiLogger.info({ event: "extension.terminal.log", metadata: metadata ?? {} }, message),
      warn: (message, metadata) =>
        apiLogger.warn({ event: "extension.terminal.log", metadata: metadata ?? {} }, message),
      error: (message, metadata) =>
        apiLogger.error({ event: "extension.terminal.log", metadata: metadata ?? {} }, message),
    },
  });

const createRuntimeRouteDeps = (input: {
  extensionScheduler: ReturnType<typeof createExtensionScheduler>;
  host: RuntimeHost | undefined;
  sessionService: ReturnType<typeof createSessionService>;
  terminalSupervisor: ReturnType<typeof createTerminalSupervisor>;
}) => {
  if (!input.host) return undefined;

  const activeSessions = async () => {
    const rows = await Promise.all(
      (["queued", "in_progress", "awaiting_input"] as const).map((status) => input.sessionService.listByStatus(status)),
    );
    return rows.flat().map((session) => ({ id: session.id, label: session.title }));
  };

  return {
    host: input.host,
    activity: async () => ({
      sessions: await activeSessions(),
      terminals: input.terminalSupervisor.activity(),
      jobs: input.extensionScheduler.activity(),
    }),
    cancelActivity: async () => {
      const sessions = await activeSessions();
      await Promise.all(sessions.map((session) => input.sessionService.cancel(session.id)));
      await Promise.all([input.terminalSupervisor.dispose(), input.extensionScheduler.dispose()]);
    },
  };
};

const pgliteRecoveryHint = (error: unknown, dbPath: string | undefined) => {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  if (!isPgliteCheckpointFailure(message)) return null;

  const resolved = resolveDbPath(dbPath);
  return `PGlite failed to open ${resolved}. ${pgliteRecoverySteps(resolved)}.`;
};

const openDb = async (dbPath: string | undefined, onLockAcquired?: () => void) => {
  try {
    return await createDb({ path: dbPath, onLockAcquired });
  } catch (err) {
    const hint = pgliteRecoveryHint(err, dbPath);
    apiLogger.error({ dataDir: dbPath, err, event: "db.open.failed", hint }, hint ?? "PGlite database failed to open");
    if (!hint) throw err;

    throw new Error(hint, { cause: err });
  }
};

const createDBServices = (db: DbClient) => ({
  projectsDBService: createProjectsDBService(db),
  reposDBService: createReposDBService(db),
  sessionQueueEntriesService: createSessionQueueEntriesDBService(db),
  sessionsDBService: createSessionsDBService(db),
  settingsDBService: createSettingsDBService(db),
  workspacesDBService: createWorkspacesDBService(db),
  workspaceSessionsDBService: createWorkspaceSessionsDBService(db),
  skillsDBService: createSkillsDBService(db),
  templatesDBService: createTemplatesDBService(db),
  filesDBService: createFilesDBService(db),
  activityEventsService: createActivityEventsDBService(db),
  notificationsDbService: createNotificationsDBService(db),
  installedExtensionSourcesService: createInstalledExtensionSourcesDBService(db),
  extensionInstancesService: createExtensionInstancesDBService(db),
  extensionFilesDBService: createExtensionFilesDBService(db),
  extensionTemplatePreferencesDBService: createExtensionTemplatePreferencesDBService(db),
  extensionSkillPreferencesDBService: createExtensionSkillPreferencesDBService(db),
  extensionAutomationPreferencesService: createExtensionAutomationPreferencesDBService(db),
  extensionStorageService: createExtensionStorageDBService(db),
  extensionSettingsDBService: createExtensionSettingsDBService(db),
});

const createCoreDomainServices = (input: {
  db: DbClient;
  dbs: ReturnType<typeof createDBServices>;
  eventBus: EventBus;
  storageRoot: string;
}) => {
  const { db, dbs, eventBus, storageRoot } = input;
  const filesStorageService = createFilesStorageService(storageRoot);
  const fileService = createFileService({ filesDBService: dbs.filesDBService, filesStorageService });

  return {
    fileService,
    projectService: createProjectService({ projectsDBService: dbs.projectsDBService }),
    repoService: createRepoService({ reposDBService: dbs.reposDBService }),
    extensionFileService: createExtensionFileService({
      eventBus,
      extensionFilesDBService: dbs.extensionFilesDBService,
      extensionInstancesDBService: dbs.extensionInstancesService,
      fileService,
    }),
    syncService: createSyncService({ db, eventBus }),
    notificationService: createNotificationService({
      notificationsDb: dbs.notificationsDbService,
      activityEventsService: dbs.activityEventsService,
      eventBus,
    }),
    extensionSettingsService: createExtensionSettingsService({
      extensionSettingsDBService: dbs.extensionSettingsDBService,
    }),
    workspaceSessionService: createWorkspaceSessionService({
      workspaceSessionsDBService: dbs.workspaceSessionsDBService,
      eventBus,
    }),
    workspaceService: createWorkspaceService({ workspacesDb: dbs.workspacesDBService, eventBus }),
  };
};

const startNotificationWakeTimer = (notificationService: ReturnType<typeof createNotificationService>) => {
  const timer = setInterval(() => {
    notificationService
      .wakeDueSnoozed()
      .catch((err) =>
        apiLogger.error({ err, event: "notifications.snooze_wakeup.error" }, "Failed to wake notifications"),
      );
  }, 30_000);
  timer.unref?.();
  return timer;
};

export const createApp = async (options: AppOptions) => {
  const dbPath = options?.dbPath ?? process.env.PSTDIO_DB_PATH;
  const { db, close: closeDb } = await openDb(dbPath, options.onDatabaseLockAcquired);
  const apiToken = options?.apiToken ?? process.env.PSTDIO_API_TOKEN;
  const securityToken = apiToken ?? options.runtimeHost?.token;
  const app = new OpenAPIHono<AppBindings>();

  const storageRoot = options?.storagePath ?? resolveStorageRoot(process.env.PSTDIO_STORAGE_PATH);
  ensureStorageRoot(storageRoot);

  const dbs = createDBServices(db);
  const {
    activityEventsService,
    extensionAutomationPreferencesService,
    extensionInstancesService,
    extensionSettingsDBService,
    extensionSkillPreferencesDBService,
    extensionStorageService,
    extensionTemplatePreferencesDBService,
    installedExtensionSourcesService,
    notificationsDbService,
    sessionQueueEntriesService,
    sessionsDBService,
    settingsDBService,
    skillsDBService,
    templatesDBService,
  } = dbs;

  // --- infrastructure ---
  const eventBus = new EventBus({
    bufferSize: options.eventBusBufferSize ?? resolveEventBusBufferSize(process.env.PSTDIO_EVENT_BUS_BUFFER_SIZE),
  });

  // --- domain services ---
  const {
    extensionFileService,
    extensionSettingsService,
    fileService,
    notificationService,
    projectService,
    repoService,
    syncService,
    workspaceSessionService,
    workspaceService,
  } = createCoreDomainServices({ db, dbs, eventBus, storageRoot });
  let refreshInstalledExtensionProcesses: (sourcePath?: string, validatedSource?: LoadedExtension) => Promise<void> =
    async () => {};
  const extensionService = createExtensionService({
    extensionInstancesService,
    installedExtensionSourcesService,
    extensionUserDataService: createExtensionUserDataDBService(db),
    eventBus,
    onInstalledSourcesChanged: async (sourcePath, validatedSource) => {
      // An in-place source reload keeps the same paths, so the registry's path-set
      // signature won't change on its own — drop its cache explicitly.
      harnessRegistry.invalidate();
      await refreshInstalledExtensionProcesses(sourcePath, validatedSource);
    },
    projectService,
  });
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
    extensionRuntimeCatalog: extensionRuntime.projectRuntimeCatalog,
    extensionTemplatePreferencesDBService,
    fileService,
    projectTemplateDefaultsDBService: createProjectTemplateDefaultsDBService(db),
    templatesDBService,
  });
  const skillService = createSkillService({
    extensionRuntimeCatalog: extensionRuntime.projectRuntimeCatalog,
    extensionSkillPreferencesDBService,
    fileService,
    skillsDBService,
  });

  const sessionHookDeps = (): SessionHookDeps => ({
    activityEventsService,
    eventBus,
    extensionAutomationPreferencesService,
    extensionFileService,
    extensionInstancesService,
    extensionService,
    extensionSettingsDBService,
    extensionSettingsService,
    extensionStorageService,
    fileService,
    harnessRegistry,
    projectService,
    repoService,
    sessionQueueEntriesService,
    sessionService,
    skillService,
    notificationService,
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
  const terminalSupervisor = createAppTerminalSupervisor();

  const deps: RouteDeps = {
    filesRoot: options.filesRoot,
    readiness: { database: true, storage: true },
    closeDb,
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
    notificationsDbService,
    notificationService,
    installedExtensionSourcesService,
    extensionInstancesService,
    extensionAutomationPreferencesService,
    extensionFileService,
    extensionSettingsDBService,
    extensionService,
    extensionSettingsService,
    extensionStorageService,
    syncService,
    activityEventsService,
    terminal: terminalSupervisor.api,
  };

  const extensionScheduler = createExtensionScheduler({
    deps,
    listProjectIds: async () => (await projectService.list()).map((project) => project.id),
    watermarkPath: join(storageRoot, EXTENSION_SCHEDULE_WATERMARK_FILE),
  });
  const notificationWakeTimer = startNotificationWakeTimer(notificationService);

  const runtimeDeps = createRuntimeRouteDeps({
    extensionScheduler,
    host: options.runtimeHost,
    sessionService,
    terminalSupervisor,
  });
  if (runtimeDeps) deps.runtime = runtimeDeps;

  drainSessionQueue = async (input) => {
    await createSessionScheduler(deps).drainQueue(input);
  };

  registerApi(app, deps, {
    security: securityToken
      ? {
          token: securityToken,
          ...(options.runtimeHost ? { origin: options.runtimeHost.origin } : {}),
        }
      : undefined,
    terminalOrigins: options.terminalOrigins ?? readTerminalOrigins(),
  });

  const startupAbort = new AbortController();
  const startupDone = runStartupTasks(deps, startupAbort.signal, {
    recoverQueuedSessions: () => createSessionScheduler(deps).recoverQueuedSessions(),
  }).catch((err) => apiLogger.error({ err, event: "api.startup.error" }, "Startup task failed"));

  let closePromise: Promise<void> | null = null;
  const close = async () => {
    closePromise ??= (async () => {
      startupAbort.abort();
      await startupDone;
      clearInterval(notificationWakeTimer);
      unsubscribeRepoLinkRefresh();
      extensionRuntime.dispose();
      await extensionScheduler.dispose();
      await terminalSupervisor.dispose();
      await closeDb();
    })();

    await closePromise;
  };
  return { app, close, deps, eventBus };
};
