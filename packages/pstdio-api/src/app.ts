import { OpenAPIHono } from "@hono/zod-openapi";
import { websocket } from "hono/bun";
import { createStoragePositions } from "pstdio-api-contracts";
import { ensureStorageRoot } from "pstdio-storage";
import type { AppDependencies, CreateAppInput } from "./app-contracts";
import { createAppDatabaseServices, openAppDatabase } from "./app-database";
import { createAppSettingsService, createCoreDomainServices } from "./app-domain-services";
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
import { provisionWorkspacesUsingSource } from "./features/extensions/extension-skill-cleanup";
import { createExtensionWebviewAccess } from "./features/extensions/extension-webview-access";
import type { SessionHookDeps } from "./features/hooks/session-hooks";
import type { RuntimeRouteDeps } from "./features/runtime/routes";
import { createSessionQueueLifecycle } from "./features/sessions/session-queue-lifecycle";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import { EventBus } from "./features/sync/event-bus";
import { logStartupPhase } from "./lib/startup-phase";
import { createAppAccount } from "./services/account/app-account";
import { createExtensionAutomationPreferencesService } from "./services/extension-automation-preferences-service";
import { createSessionLifecycleCallbacks } from "./services/session-lifecycle-callbacks";
import { createSessionQueueService } from "./services/session-queue-service";
import { createSessionService } from "./services/session-service";
import { createSkillService } from "./services/skill-service";
import type { AppBindings } from "./types";

const AUTOMATION_RUN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const apiWebSocket = websocket;
export type { AppConfig, ExtensionRelease } from "./app-config";
export { resolveAppConfig } from "./app-config";
export type { AppDependencies, AppHost, AppLifecycle, CreateAppInput } from "./app-contracts";
export { closeBeforeFatalExit } from "./app-runtime";
export { assertListenHostAllowed } from "./listen-host";

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

const sessionQueueChanged =
  (sessions: ReturnType<typeof createAppDatabaseServices>["sessionsDBService"], eventBus: EventBus) =>
  async (id: string) => {
    const session = await sessions.update(id, {});
    if (session) eventBus.emit("sessions", "set", session);
  };

const registerAppRuntime = (
  app: OpenAPIHono<AppBindings>,
  deps: RouteDeps,
  input: CreateAppInput,
  runtime: Parameters<typeof createRuntimeRouteDeps>[0],
) => {
  const runtimeDeps = createRuntimeRouteDeps(runtime);
  if (runtimeDeps) deps.runtime = runtimeDeps;
  registerApi(app, deps, {
    security: apiSecurity(input.host, runtimeDeps),
    terminalOrigins: input.config.transport.terminalOrigins,
  });
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
  const { environmentId } = await dbs.environmentDBService.get();
  const storagePositions = createStoragePositions(environmentId);
  const {
    activityEventsDBService,
    automationDBService,
    extensionAutomationPreferencesDBService,
    extensionConnectionsDBService,
    extensionInstancesDBService,
    extensionSettingsDBService,
    extensionSkillPreferencesDBService,
    extensionStorageDBService,
    installedExtensionSourcesDBService,
    boardViewsDBService,
    sessionQueueEntriesDBService,
    sessionsDBService,
    settingsDBService,
    skillsDBService,
  } = dbs;

  const eventBus = new EventBus({ bufferSize: input.config.sync.eventBufferSize });
  const artifactMountWrites = createArtifactMountWriteLedger();
  const sessionQueueEntriesService = createSessionQueueService(
    sessionQueueEntriesDBService,
    sessionQueueChanged(sessionsDBService, eventBus),
  );
  const extensionAutomationPreferencesService = createExtensionAutomationPreferencesService({
    db: extensionAutomationPreferencesDBService,
    eventBus,
  });

  const {
    assetTransferService,
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
  });
  let deps!: RouteDeps;
  const {
    extensionConnectionService,
    extensionRuntime,
    extensionStartup,
    extensionRuntimeCatalog,
    extensionService,
    extensionUpgradeService,
    harnessRegistry,
    unsubscribeExtensionEvents,
  } = wireAppExtensionServices({
    config: input.config.extensions,
    db,
    dependencies,
    eventBus,
    extensionInstancesDBService,
    extensionConnectionsDBService,
    installedExtensionSourcesDBService,
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
  const sessionHookDeps = (): SessionHookDeps => deps;

  let drainSessionQueue: (input?: { releasedSessionId?: string }) => Promise<void> = async () => {};

  const sessionService = createSessionService({
    sessionsDb: sessionsDBService,
    validateCreatedAnchors: (source, anchors) => validateLegacyAnchors(deps, source, anchors),
    eventBus,
    ...createSessionLifecycleCallbacks(sessionHookDeps),
    onCapacityAvailable: (input) => drainSessionQueue(input),
  });
  const settingsService = await createAppSettingsService({
    eventBus,
    settingsDb: settingsDBService,
    onCapacityAvailable: () => drainSessionQueue(),
  });

  const terminalSupervisor = createAppTerminalSupervisor();
  const account = createAppAccount(input.config, dbs.environmentDBService, projectService);

  deps = {
    accountService: account.accountService,
    assetTransferService,
    environmentService: dbs.environmentDBService,
    storagePositions,
    artifactMountWrites,
    resourceLinksService: dbs.resourceLinksDBService,
    extensionResourceSequencesService: dbs.extensionResourceSequencesDBService,
    extensionWebviewAccess: createExtensionWebviewAccess(),
    readiness: { database: true, storage: true },
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
    boardViewsService: boardViewsDBService,
    notificationService,
    installedExtensionSourcesService: installedExtensionSourcesDBService,
    extensionAutomationPreferencesService,
    extensionConnectionService,
    extensionFileService,
    extensionRuntimeCatalog,
    webviewPreferencesDBService: dbs.webviewPreferencesDBService,
    extensionSettingsDBService,
    extensionService,
    extensionUpgradeService,
    extensionSettingsService,
    extensionStorageService: extensionStorageDBService,
    syncService,
    activityEventsService: activityEventsDBService,
    ensureExtensionWebviews: extensionRuntime.ensureWebviews,
    terminal: terminalSupervisor.api,
  };

  await automationService.recoverInterruptedRuns();

  const extensionScheduler = startAppExtensionScheduler(deps, projectService, storageRoot);
  const artifactMountWatch = startAppArtifactMountWatch(deps, projectService);
  const notificationWakeTimer = startNotificationWakeTimer(notificationService);

  registerAppRuntime(app, deps, input, {
    extensionScheduler,
    host: runtimeHost,
    sessionService,
    terminalSupervisor,
  });

  drainSessionQueue = (input) => createSessionScheduler(deps).drainQueue(input);

  const close = await startAppLifecycle({
    deps,
    notificationWakeTimer,
    unsubscribeExtensionEvents,
    extensionRuntime,
    extensionStartup,
    extensionScheduler,
    artifactMountWatch,
    automationService,
    terminalSupervisor,
    closeDb,
  });
  return account.connectAccountRelay({ app, close, deps, eventBus });
};

export const createApp = async (input: CreateAppInput, dependencies: AppDependencies = productionAppDependencies) => {
  const database = await openAppDatabase(input.config.database.path, input.lifecycle);
  try {
    const app = await buildApp(input, dependencies, database);
    logStartupPhase("app_ready");
    return app;
  } catch (error) {
    // Nothing else owns the database until startup returns its close function.
    await database.close();
    throw error;
  }
};
