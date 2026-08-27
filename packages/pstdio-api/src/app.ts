import { OpenAPIHono } from "@hono/zod-openapi";
import { websocket } from "hono/bun";
import { sessionEvents } from "pstdio-api-contracts/extension-kernel";
import { ensureStorageRoot, resolveStorageRoot } from "pstdio-storage";
import type { AppOptions } from "./app-options";
import { registerApi } from "./app-routing";
import {
  createAppCloser,
  createAppTerminalSupervisor,
  createRuntimeRouteDeps,
  readTerminalOrigins,
  resolveEventBusBufferSize,
  sessionStatusEventFor,
  startAppExtensionScheduler,
  startNotificationWakeTimer,
} from "./app-runtime";
import {
  createCatalogServices,
  createCoreDomainServices,
  createDBServices,
  openAppDb,
  wireExtensionRuntimeServices,
} from "./app-services";
import { createAutomationService } from "./features/automation/automation-service";
import type { RouteDeps } from "./features/deps";
import { createExtensionWebviewAccess } from "./features/extensions/extension-webview-access";
import { fireSessionLifecycleEventAsync, type SessionHookDeps } from "./features/hooks/session-hooks";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import { EventBus } from "./features/sync/event-bus";
import { apiLogger } from "./lib/logger";
import { createSessionService } from "./services/session-service";
import { createSettingsService } from "./services/settings-service";
import { runStartupTasks } from "./startup";
import type { AppBindings } from "./types";

const AUTOMATION_RUN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const apiWebSocket = websocket;

export const createApp = async (options: AppOptions) => {
  const { db, close: closeDb } = await openAppDb(options);
  const securityToken = options?.apiToken ?? process.env.PSTDIO_API_TOKEN ?? options.runtimeHost?.token;
  const app = new OpenAPIHono<AppBindings>();

  const storageRoot = options?.storagePath ?? resolveStorageRoot(process.env.PSTDIO_STORAGE_PATH);
  ensureStorageRoot(storageRoot);

  const dbs = createDBServices(db);
  const {
    activityEventsService,
    automationDBService,
    extensionAutomationPreferencesService,
    extensionConnectionsDBService,
    extensionInstancesService,
    extensionSettingsDBService,
    extensionStorageService,
    installedExtensionSourcesService,
    notificationsDbService,
    sessionQueueEntriesService,
    sessionsDBService,
    settingsDBService,
  } = dbs;

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
  const {
    extensionRuntime,
    extensionRuntimeCatalog,
    extensionConnectionService,
    extensionService,
    extensionUpgradeService,
    harnessRegistry,
    unsubscribeExtensionEvents,
  } = await wireExtensionRuntimeServices({
    db,
    eventBus,
    extensionInstancesService,
    extensionConnectionsDBService,
    installedExtensionSourcesService,
    options,
    projectService,
    repoService,
    storageRoot,
  });
  const { templateService, skillService } = createCatalogServices({
    db,
    dbs,
    extensionRuntimeCatalog,
    fileService,
  });
  let deps!: RouteDeps;
  const automationService = createAutomationService({
    automationDBService,
    getCommandDeps: () => deps,
    maxRunsPerMinute: options.automationRunsPerMinute,
  });
  await automationDBService.recoverInterruptedRuns();
  await automationDBService.pruneTerminalRuns(new Date(Date.now() - AUTOMATION_RUN_RETENTION_MS).toISOString());

  const sessionHookDeps = (): SessionHookDeps => ({
    activityEventsService,
    eventBus,
    extensionAutomationPreferencesService,
    extensionConnectionService,
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

  // --- ONLY DOMAIN SERVICES ARE PASSED TO ROUTES ---
  const terminalSupervisor = createAppTerminalSupervisor();

  deps = {
    filesRoot: options.filesRoot,
    extensionWebviewAccess: createExtensionWebviewAccess(),
    readiness: { database: true, storage: true },
    closeDb,
    eventBus,
    automationService,
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
    extensionConnectionService,
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
  const extensionScheduler = startAppExtensionScheduler(deps, projectService, storageRoot);
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

  const startupAbort = new AbortController();
  let startupBackgroundDone = Promise.resolve();
  const startupDone = runStartupTasks(deps, startupAbort.signal, {
    onBackgroundTask: (task) => {
      startupBackgroundDone = task;
    },
    recoverQueuedAutomation: async () => {
      await automationService.recoverQueuedRuns();
    },
    recoverQueuedSessions: () => createSessionScheduler(deps).recoverQueuedSessions(),
  }).catch((err) => apiLogger.error({ err, event: "api.startup.error" }, "Startup task failed"));
  await startupDone;

  registerApi(app, deps, {
    security: securityToken
      ? {
          token: securityToken,
          ...(options.runtimeHost ? { origin: options.runtimeHost.origin } : {}),
        }
      : undefined,
    terminalOrigins: options.terminalOrigins ?? readTerminalOrigins(),
  });

  const close = createAppCloser({
    startupAbort,
    startupDone,
    getStartupBackgroundDone: () => startupBackgroundDone,
    notificationWakeTimer,
    unsubscribeExtensionEvents,
    extensionRuntime,
    extensionScheduler,
    automationService,
    terminalSupervisor,
    closeDb,
  });
  return { app, close, deps, eventBus };
};
