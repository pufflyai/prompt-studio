import { OpenAPIHono } from "@hono/zod-openapi";
import { websocket } from "hono/bun";
import { createFilesStorageService, ensureStorageRoot } from "pstdio-storage";
import type { AppDependencies, CreateAppInput } from "./app-contracts";
import { createAppDatabaseServices, openAppDatabase } from "./app-database";
import { productionAppDependencies, wireAppExtensionServices } from "./app-extension-services";
import { registerApi } from "./app-routing";
import {
  createAppTerminalSupervisor,
  createRuntimeRouteDeps,
  startAppArtifactMountWatch,
  startAppExtensionScheduler,
  startAppLifecycle,
  startNotificationWakeTimer,
} from "./app-runtime";
import { createAutomationService } from "./features/automation/automation-service";
import type { RouteDeps } from "./features/deps";
import { createArtifactMountWriteLedger } from "./features/extensions/artifact-mount-watch/write-ledger";
import { validateLegacyAnchors } from "./features/extensions/command-environment/resource-link-policy";
import { createExtensionSettingsService } from "./features/extensions/extension-settings-service";
import { provisionWorkspacesUsingSource } from "./features/extensions/extension-skill-cleanup";
import { createExtensionWebviewAccess } from "./features/extensions/extension-webview-access";
import type { SessionHookDeps } from "./features/hooks/session-hooks";
import type { RuntimeRouteDeps } from "./features/runtime/routes";
import { createSessionQueueLifecycle } from "./features/sessions/session-queue-lifecycle";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import { EventBus } from "./features/sync/event-bus";
import { createExtensionAutomationPreferencesService } from "./services/extension-automation-preferences-service";
import { createExtensionFileService } from "./services/extension-file-service";
import { createFileService } from "./services/file-service";
import { createNotificationService } from "./services/notification-service";
import { createProjectService } from "./services/project-service";
import { createSessionLifecycleCallbacks } from "./services/session-lifecycle-callbacks";
import { createSessionQueueService } from "./services/session-queue-service";
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
export { closeBeforeFatalExit } from "./app-runtime";
export { assertListenHostAllowed } from "./listen-host";

const createCoreDomainServices = (input: {
  getCommandDeps: () => RouteDeps;
  db: Parameters<typeof createAppDatabaseServices>[0];
  dbs: ReturnType<typeof createAppDatabaseServices>;
  eventBus: EventBus;
  storageRoot: string;
  onInstalledSourcesChanged: (path?: string) => Promise<void>;
}) => {
  const { db, dbs, eventBus, storageRoot } = input;
  const filesStorageService = createFilesStorageService(storageRoot);
  const fileService = createFileService({ filesDBService: dbs.filesDBService, filesStorageService, eventBus });

  const syncService = createSyncService({ db });

  return {
    fileService,
    projectService: createProjectService({ projectsDBService: dbs.projectsDBService, syncService, eventBus }),
    extensionFileService: createExtensionFileService({
      extensionFilesDBService: dbs.extensionFilesDBService,
      extensionInstancesDBService: dbs.extensionInstancesService,
      fileService,
    }),
    syncService,
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
    workspaceService: createWorkspaceService({
      workspacesDb: dbs.workspacesDBService,
      sessionsDb: dbs.sessionsDBService,
      eventBus,
      validateCreatedAnchors: (source, anchors) => validateLegacyAnchors(input.getCommandDeps(), source, anchors),
    }),
  };
};

const createAppAutomationService = async (input: {
  automationDBService: ReturnType<typeof createAppDatabaseServices>["automationDBService"];
  getCommandDeps: () => RouteDeps;
  maxRunsPerMinute: number;
}) => {
  const service = createAutomationService(input);
  await input.automationDBService.pruneTerminalRuns(new Date(Date.now() - AUTOMATION_RUN_RETENTION_MS).toISOString());
  return service;
};

// A runtime accepts its token and its own browser session secret as bearer credentials.
const apiSecurity = (host: CreateAppInput["host"], runtime: RuntimeRouteDeps | undefined) => {
  if (runtime)
    return { token: runtime.host.token, origin: runtime.host.origin, browserSessions: runtime.browserSessions };
  return host.kind === "standalone" && host.token ? { token: host.token } : undefined;
};

const buildApp = async (
  input: CreateAppInput,
  dependencies: AppDependencies,
  database: Awaited<ReturnType<typeof openAppDatabase>>,
) => {
  const { db, close: closeDb } = database;
  const runtimeHost = input.host.kind === "runtime" ? input.host.runtime : undefined;
  const app = new OpenAPIHono<AppBindings>();

  const storageRoot = input.config.storage.root;
  ensureStorageRoot(storageRoot);

  const dbs = createAppDatabaseServices(db);
  const {
    activityEventsService,
    automationDBService,
    extensionAutomationPreferencesService: extensionAutomationPreferencesDBService,
    extensionConnectionsDBService,
    extensionInstancesService,
    extensionSettingsDBService,
    extensionSkillPreferencesDBService,
    extensionStorageService,
    installedExtensionSourcesService,
    boardViewsService,
    notificationsDbService,
    sessionQueueEntriesService: rawSessionQueueEntriesService,
    sessionsDBService,
    settingsDBService,
    skillsDBService,
  } = dbs;

  const eventBus = new EventBus({ bufferSize: input.config.sync.eventBufferSize });
  const artifactMountWrites = createArtifactMountWriteLedger();
  const sessionQueueEntriesService = createSessionQueueService(rawSessionQueueEntriesService, async (id) => {
    const session = await sessionsDBService.update(id, {});
    if (session) eventBus.emit("sessions", "set", session);
  });
  const extensionAutomationPreferencesService = createExtensionAutomationPreferencesService({
    db: extensionAutomationPreferencesDBService,
    eventBus,
  });

  const {
    extensionFileService,
    extensionSettingsService,
    fileService,
    notificationService,
    projectService,
    syncService,
    workspaceSessionService,
    workspaceService,
  } = createCoreDomainServices({
    getCommandDeps: () => deps,
    db,
    dbs,
    eventBus,
    storageRoot,
    onInstalledSourcesChanged: (path) => refreshInstalledSources(path),
  });
  let deps!: RouteDeps;
  const {
    extensionConnectionService,
    extensionRuntime,
    extensionRuntimeCatalog,
    extensionService,
    extensionUpgradeService,
    harnessRegistry,
    unsubscribeExtensionEvents,
    refreshInstalledSources,
  } = await wireAppExtensionServices({
    config: input.config.extensions,
    db,
    dependencies,
    eventBus,
    extensionInstancesService,
    extensionConnectionsDBService,
    installedExtensionSourcesService,
    projectService,
    provisionWorkspacesUsingSource: (sourcePath) => provisionWorkspacesUsingSource(deps, sourcePath),
    workspaceService,
    storageRoot,
  });
  const skillService = createSkillService({
    eventBus,
    extensionRuntimeCatalog,
    extensionSkillPreferencesDBService,
    fileService,
    skillsDBService,
  });

  const automationService = await createAppAutomationService({
    automationDBService,
    getCommandDeps: () => deps,
    maxRunsPerMinute: input.config.automation.runsPerMinute,
  });

  const sessionQueueLifecycle = createSessionQueueLifecycle();
  const sessionHookDeps = (): SessionHookDeps => ({
    artifactMountWrites,
    automationService,
    extensionResourceSequencesService: dbs.extensionResourceSequencesService,
    resourceLinksService: dbs.resourceLinksService,
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
    sessionQueueEntriesService,
    sessionQueueLifecycle,
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
    validateCreatedAnchors: (source, anchors) => validateLegacyAnchors(deps, source, anchors),
    eventBus,
    ...createSessionLifecycleCallbacks(sessionHookDeps),
    onCapacityAvailable: (input) => drainSessionQueue(input),
  });
  await settingsDBService.get();
  const settingsService = createSettingsService({
    eventBus,
    settingsDb: settingsDBService,
    onCapacityAvailable: () => drainSessionQueue(),
  });

  const terminalSupervisor = createAppTerminalSupervisor();

  deps = {
    artifactMountWrites,
    resourceLinksService: dbs.resourceLinksService,
    extensionResourceSequencesService: dbs.extensionResourceSequencesService,
    extensionWebviewAccess: createExtensionWebviewAccess(),
    readiness: { database: true, storage: true },
    closeDb,
    eventBus,
    automationService,
    harnessRegistry,
    projectService,
    sessionQueueEntriesService,
    sessionQueueLifecycle,
    sessionService,
    settingsService,
    workspaceService,
    workspaceSessionService,
    skillService,
    fileService,
    boardViewsService,
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
    ensureExtensionWebviews: extensionRuntime.ensureWebviews,
    terminal: terminalSupervisor.api,
  };

  await automationService.recoverInterruptedRuns();

  const extensionScheduler = startAppExtensionScheduler(deps, projectService, storageRoot);
  const artifactMountWatch = startAppArtifactMountWatch(deps, projectService);
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
    security: apiSecurity(input.host, runtimeDeps),
    terminalOrigins: input.config.transport.terminalOrigins,
  });

  const close = await startAppLifecycle({
    deps,
    notificationWakeTimer,
    unsubscribeExtensionEvents,
    extensionRuntime,
    extensionScheduler,
    artifactMountWatch,
    automationService,
    terminalSupervisor,
    closeDb,
  });
  return { app, close, deps, eventBus };
};

export const createApp = async (input: CreateAppInput, dependencies: AppDependencies = productionAppDependencies) => {
  const database = await openAppDatabase(input.config.database.path, input.lifecycle);
  try {
    return await buildApp(input, dependencies, database);
  } catch (error) {
    // Nothing else owns the database until startup returns its close function.
    await database.close();
    throw error;
  }
};
