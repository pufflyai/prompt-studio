import { OpenAPIHono } from "@hono/zod-openapi";
import { websocket } from "hono/bun";
import { sessionEvents } from "pstdio-api-contracts/extension-kernel";
import { createFilesStorageService, ensureStorageRoot } from "pstdio-storage";
import type { AppDependencies, CreateAppInput } from "./app-contracts";
import { createAppDatabaseServices, openAppDatabase } from "./app-database";
import { productionAppDependencies, wireAppExtensionServices } from "./app-extension-services";
import { registerApi } from "./app-routing";
import {
  createAppTerminalSupervisor,
  createRuntimeRouteDeps,
  sessionStatusEventFor,
  startAppExtensionScheduler,
  startAppLifecycle,
  startNotificationWakeTimer,
} from "./app-runtime";
import { createAutomationService } from "./features/automation/automation-service";
import type { RouteDeps } from "./features/deps";
import { createExtensionSettingsService } from "./features/extensions/extension-settings-service";
import { createExtensionWebviewAccess } from "./features/extensions/extension-webview-access";
import { fireSessionLifecycleEventAsync, type SessionHookDeps } from "./features/hooks/session-hooks";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import { EventBus } from "./features/sync/event-bus";
import { createExtensionFileService } from "./services/extension-file-service";
import { createFileService } from "./services/file-service";
import { createNotificationService } from "./services/notification-service";
import { createProjectService } from "./services/project-service";
import { createRepoService } from "./services/repo-service";
import { createSessionService } from "./services/session-service";
import { createSettingsService } from "./services/settings-service";
import { createSkillService } from "./services/skill-service";
import { createSyncService } from "./services/sync-service";
import { createWorkspaceService } from "./services/workspace-service";
import { createWorkspaceSessionService } from "./services/workspace-session-service";
import type { AppBindings } from "./types";

const AUTOMATION_RUN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const apiWebSocket = websocket;
export type { AppConfig, ExtensionRelease } from "./app-config";
export { resolveAppConfig } from "./app-config";
export type { AppDependencies, AppHost, AppLifecycle, CreateAppInput } from "./app-contracts";

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

const createAppAutomationService = async (input: {
  automationDBService: ReturnType<typeof createAppDatabaseServices>["automationDBService"];
  getCommandDeps: () => RouteDeps;
  maxRunsPerMinute: number;
}) => {
  const service = createAutomationService(input);
  await input.automationDBService.recoverInterruptedRuns();
  await input.automationDBService.pruneTerminalRuns(new Date(Date.now() - AUTOMATION_RUN_RETENTION_MS).toISOString());
  return service;
};

const appHostSecurity = (host: CreateAppInput["host"]) =>
  host.kind === "runtime"
    ? { runtimeHost: host.runtime, securityToken: host.runtime.token }
    : { runtimeHost: undefined, securityToken: host.token };

export const createApp = async (input: CreateAppInput, dependencies: AppDependencies = productionAppDependencies) => {
  const { db, close: closeDb } = await openAppDatabase(input.config.database.path, input.lifecycle);
  const { runtimeHost, securityToken } = appHostSecurity(input.host);
  const app = new OpenAPIHono<AppBindings>();

  const storageRoot = input.config.storage.root;
  ensureStorageRoot(storageRoot);

  const dbs = createAppDatabaseServices(db);
  const {
    activityEventsService,
    automationDBService,
    extensionAutomationPreferencesService,
    extensionConnectionsDBService,
    extensionInstancesService,
    extensionSettingsDBService,
    extensionSkillPreferencesDBService,
    extensionStorageService,
    installedExtensionSourcesService,
    notificationsDbService,
    sessionQueueEntriesService,
    sessionsDBService,
    settingsDBService,
    skillsDBService,
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
    extensionConnectionService,
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
    extensionConnectionsDBService,
    installedExtensionSourcesService,
    projectService,
    repoService,
    storageRoot,
  });
  const skillService = createSkillService({
    extensionRuntimeCatalog,
    extensionSkillPreferencesDBService,
    fileService,
    skillsDBService,
  });

  let deps!: RouteDeps;
  const automationService = await createAppAutomationService({
    automationDBService,
    getCommandDeps: () => deps,
    maxRunsPerMinute: input.config.automation.runsPerMinute,
  });

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

  deps = {
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
    host: runtimeHost,
    sessionService,
    terminalSupervisor,
  });
  if (runtimeDeps) deps.runtime = runtimeDeps;

  drainSessionQueue = (input) => createSessionScheduler(deps).drainQueue(input);

  registerApi(app, deps, {
    security: securityToken
      ? {
          token: securityToken,
          ...(runtimeHost ? { origin: runtimeHost.origin } : {}),
        }
      : undefined,
    terminalOrigins: input.config.transport.terminalOrigins,
  });

  const close = await startAppLifecycle({
    deps,
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
