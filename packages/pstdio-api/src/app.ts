import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { websocket } from "hono/bun";
import { sessionEvents } from "pstdio-api-contracts/extension-kernel";
import { createFilesStorageService, ensureStorageRoot } from "pstdio-storage";
import type { AppDependencies, CreateAppInput } from "./app-contracts";
import { createAppDatabaseServices, openAppDatabase } from "./app-database";
import { productionAppDependencies, wireAppExtensionServices } from "./app-extension-services";
import { registerApi } from "./app-routing";
import type { RouteDeps } from "./features/deps";
import { createExtensionScheduler } from "./features/extensions/extension-scheduler";
import { createExtensionSettingsService } from "./features/extensions/extension-settings-service";
import { createTerminalSupervisor } from "./features/extensions/extension-terminal-runtime";
import { createExtensionWebviewAccess } from "./features/extensions/extension-webview-access";
import { fireSessionLifecycleEventAsync, type SessionHookDeps } from "./features/hooks/session-hooks";
import type { RuntimeHost } from "./features/runtime/routes";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import { EventBus } from "./features/sync/event-bus";
import { apiLogger } from "./lib/logger";
import { createExtensionFileService } from "./services/extension-file-service";
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
export type { AppConfig, ExtensionRelease } from "./app-config";
export { resolveAppConfig } from "./app-config";
export type { AppDependencies, AppHost, AppLifecycle, CreateAppInput } from "./app-contracts";

const sessionStatusEventFor = (status: string) => {
  if (status === "awaiting_input") return sessionEvents.awaitingInput;
  if (status === "completed") return sessionEvents.succeeded;
  if (status === "failed") return sessionEvents.failed;
  return null;
};

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

const createCoreDomainServices = (input: {
  db: Parameters<typeof createAppDatabaseServices>[0];
  dbs: ReturnType<typeof createAppDatabaseServices>;
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

export const createApp = async (input: CreateAppInput, dependencies: AppDependencies = productionAppDependencies) => {
  const { db, close: closeDb } = await openAppDatabase(input.config.database.path, input.lifecycle);
  const runtimeHost = input.host.kind === "runtime" ? input.host.runtime : undefined;
  const securityToken = input.host.kind === "runtime" ? input.host.runtime.token : input.host.token;
  const app = new OpenAPIHono<AppBindings>();

  const storageRoot = input.config.storage.root;
  ensureStorageRoot(storageRoot);

  const dbs = createAppDatabaseServices(db);
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

  const eventBus = new EventBus({ bufferSize: input.config.sync.eventBufferSize });

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
  const {
    extensionRuntime,
    extensionRuntimeCatalog,
    extensionService,
    extensionUpgradeService,
    harnessRegistry,
    unsubscribeExtensionEvents,
  } = await wireAppExtensionServices({
    config: input.config.extensions,
    db,
    dependencies,
    eventBus,
    extensionInstancesService,
    installedExtensionSourcesService,
    projectService,
    repoService,
  });
  const templateService = createTemplateService({
    extensionRuntimeCatalog,
    extensionTemplatePreferencesDBService,
    fileService,
    projectTemplateDefaultsDBService: dbs.projectTemplateDefaultsDBService,
    templatesDBService,
  });
  const skillService = createSkillService({
    extensionRuntimeCatalog,
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
    extensionRuntimeCatalog,
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

  const terminalSupervisor = createAppTerminalSupervisor();

  const deps: RouteDeps = {
    extensionWebviewAccess: createExtensionWebviewAccess(),
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
    extensionRuntimeCatalog,
    extensionSettingsDBService,
    extensionService,
    extensionUpgradeService,
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
    host: runtimeHost,
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
          ...(runtimeHost ? { origin: runtimeHost.origin } : {}),
        }
      : undefined,
    terminalOrigins: input.config.transport.terminalOrigins,
  });

  const startupAbort = new AbortController();
  const startupBackgroundTasks: Promise<void>[] = [];
  const startupDone = runStartupTasks(deps, startupAbort.signal, {
    onBackgroundTask: (task) => {
      startupBackgroundTasks.push(
        task.catch((err) => apiLogger.error({ err, event: "api.startup.background.error" }, "Startup task failed")),
      );
    },
    recoverQueuedSessions: () => createSessionScheduler(deps).recoverQueuedSessions(),
  }).catch((err) => apiLogger.error({ err, event: "api.startup.error" }, "Startup task failed"));

  let closePromise: Promise<void> | null = null;
  const close = async () => {
    closePromise ??= (async () => {
      startupAbort.abort();
      await startupDone;
      await Promise.all(startupBackgroundTasks);
      clearInterval(notificationWakeTimer);
      unsubscribeExtensionEvents();
      extensionRuntime.dispose();
      await extensionScheduler.dispose();
      await terminalSupervisor.dispose();
      await closeDb();
    })();

    await closePromise;
  };
  return { app, close, deps, eventBus };
};
