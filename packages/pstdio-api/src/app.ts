import { hostname } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { websocket } from "hono/bun";
import { createStoragePositions } from "pstdio-api-contracts";
import { ensureStorageRoot } from "pstdio-storage";
import type { AppDependencies, CreateAppInput } from "./app-contracts";
import { createAppDatabaseServices, openAppDatabase, upgradeAppStorage } from "./app-database";
import { createAppPersonalHistory, createAppSettingsService, createCoreDomainServices } from "./app-domain-services";
import { productionAppDependencies, wireAppExtensionServices } from "./app-extension-services";
import { registerApi } from "./app-routing";
import {
  closeAppDatabase,
  createAppTerminalSupervisor,
  createRuntimeRouteDeps,
  startAppArtifactMountWatch,
  startAppDeadRowCleanup,
  startAppExtensionScheduler,
  startAppLifecycle,
  startNotificationWakeTimer,
} from "./app-runtime";
import { createAppSessions } from "./app-sessions";
import { registerBenchmarkCounters } from "./benchmark-counters";
import { createAutomationService } from "./features/automation/automation-service";
import type { RouteDeps } from "./features/deps";
import { createArtifactMountWriteLedger } from "./features/extensions/artifact-mount-watch/write-ledger";
import { provisionWorkspacesUsingSource } from "./features/extensions/extension-skill-cleanup";
import { createExtensionWebviewAccess } from "./features/extensions/extension-webview-access";
import { runtimeOperationOrigin } from "./features/performance/operation-origin";
import type { RuntimeRouteDeps } from "./features/runtime/routes";
import { deliverIdleFollowUp } from "./features/sessions/idle-turn";
import { createSessionImportService } from "./features/sessions/imports/service";
import { EventBus } from "./features/sync/event-bus";
import { logStartupPhase } from "./lib/startup-phase";
import { createRequestQuietPeriod } from "./request-quiet-period";
import { createAppAccount } from "./services/account/app-account";
import { createNativeDocumentService } from "./services/native-documents/documents";
import { loadNativeMarkdownFile, saveNativeMarkdownFile } from "./services/native-documents/file-source";
import { resolveNativeTextAccess } from "./services/native-documents/source-access";
import { initializeNativeSource } from "./services/native-documents/source-binding";
import { createSessionLogFiles } from "./services/personal-history/log-files";
import { createProjectWork } from "./services/project-work";
import { createSessionQueueService } from "./services/session-queue-service";
import { createSkillService } from "./services/skill-service";
import { createTextEditingService } from "./services/text-editing/service";
import { createWorkspaceCapacityService } from "./services/workspace-capacity-service";
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
  projectWork: ReturnType<typeof createProjectWork>;
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

const createAppSessionQueue = (
  dbs: ReturnType<typeof createAppDatabaseServices>,
  eventBus: EventBus,
  deliver: (id: string) => Promise<void>,
) =>
  createSessionQueueService(dbs.sessionQueueEntriesDBService, async (id) => {
    const session = await dbs.sessionsDBService.update(id, {});
    if (session) eventBus.emit("sessions", "set", session);
    // Not awaited: queue changes can hold the scheduling lock that delivery also takes.
    void deliver(id);
  });

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

const nativePresenceIdentity = async (account: ReturnType<typeof createAppAccount>["accountService"]) => {
  const { login } = await account.status();
  return { label: (login?.email ?? "Local editor").slice(0, 64), deviceName: hostname().slice(0, 64) };
};

const createAppNativeDocuments = (
  deviceId: string,
  account: ReturnType<typeof createAppAccount>["accountService"],
  getDeps: () => RouteDeps,
  storage: RouteDeps["extensionStorageService"],
  catalog: RouteDeps["extensionRuntimeCatalog"],
  projectWork: ReturnType<typeof createProjectWork>,
) => {
  const nativeDocuments = createNativeDocumentService({
    deviceId,
    projectWork,
    presenceIdentity: () => nativePresenceIdentity(account),
    catalog,
    storage,
    load: (input) => loadNativeMarkdownFile(getDeps(), input),
    access: (input) => resolveNativeTextAccess(getDeps(), input),
    initialize: (loaded) => initializeNativeSource(getDeps(), loaded),
    save: (input) => saveNativeMarkdownFile(getDeps(), input),
  });
  return {
    nativeDocuments,
    textEditing: createTextEditingService({
      documents: nativeDocuments,
      access: (input) => resolveNativeTextAccess(getDeps(), input),
      catalog,
    }),
  };
};

const createAccountWithRemovalBarrier = async (
  config: CreateAppInput["config"],
  environment: RouteDeps["environmentService"],
  projects: RouteDeps["projectService"],
  environmentId: string,
) => {
  const account = createAppAccount(config, environment, projects);
  await account.accountService.restoreLocalRemovalBarrier(environmentId, (id) => {
    projects.work.suspend(id);
    projects.work.hide(id);
  });
  return account;
};

const buildApp = async (
  input: CreateAppInput,
  dependencies: AppDependencies,
  database: Awaited<ReturnType<typeof openAppDatabase>>,
) => {
  const { db, close: closeDb } = database;
  const runtimeHost = input.host.kind === "runtime" ? input.host.runtime : undefined;
  const app = new OpenAPIHono<AppBindings>();
  const requestQuietPeriod = createRequestQuietPeriod();
  app.use("*", requestQuietPeriod.observe);
  app.use("*", runtimeOperationOrigin);

  const storageRoot = input.config.storage.root;
  ensureStorageRoot(storageRoot);

  const eventBus = new EventBus({ bufferSize: input.config.sync.eventBufferSize });
  const work = createProjectWork();
  const dbs = createAppDatabaseServices(db, database.path === ":memory:" ? storageRoot : database.path, work, eventBus);
  const { environmentId } = await dbs.environmentDBService.get();
  const storagePositions = createStoragePositions(environmentId);
  const {
    activityEventsDBService,
    automationDBService,
    extensionConnectionsDBService,
    extensionInstancesDBService,
    extensionSettingsDBService,
    extensionSkillPreferencesDBService,
    extensionStorageDBService,
    installedExtensionSourcesDBService,
    boardViewsDBService,
    sessionsDBService,
    settingsDBService,
    skillsDBService,
  } = dbs;
  await upgradeAppStorage(extensionStorageDBService);

  const artifactMountWrites = createArtifactMountWriteLedger();

  const sessionQueueEntriesService = createAppSessionQueue(dbs, eventBus, (id) => sessions.deliverIdleTurn(id));
  const core = createCoreDomainServices({
    projectWork: work,
    getCommandDeps: () => deps,
    db,
    dbs,
    eventBus,
    storageRoot,
  });
  const { fileService, notificationService, projectService, workspaceSessionService, workspaceService } = core;
  await fileService.recoverRemovals();
  let deps!: RouteDeps;
  const { extensionRuntime, extensionStartup, extensionRuntimeCatalog, unsubscribeExtensionEvents, ...extensionDeps } =
    wireAppExtensionServices({
      config: input.config.extensions,
      db,
      dependencies,
      eventBus,
      extensionInstancesDBService,
      extensionStorageDBService,
      extensionConnectionsDBService,
      installedExtensionSourcesDBService,
      projectService,
      provisionWorkspacesUsingSource: (sourcePath) => provisionWorkspacesUsingSource(deps, sourcePath),
      getProjectExtensionDeps: () => deps,
      fileService,
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
    projectWork: work,
  });

  const sessions = createAppSessions({ sessionsDBService, eventBus, deps: () => deps });
  const { sessionQueueLifecycle, sessionService } = sessions;
  const settingsService = await createAppSettingsService({
    eventBus,
    settingsDb: settingsDBService,
    onCapacityAvailable: () => sessions.drainSessionQueue(),
  });

  const workspaceCapacityService = createWorkspaceCapacityService({
    path: join(storageRoot, "device-workspace-capacity.json"),
    deviceId: environmentId,
    activeWorkspaceIds: workspaceSessionService.activeWorkspaceIds,
    onCapacityAvailable: () => sessions.drainSessionQueue(),
  });
  const terminalSupervisor = createAppTerminalSupervisor();
  const account = await createAccountWithRemovalBarrier(
    input.config,
    dbs.environmentDBService,
    projectService,
    environmentId,
  );

  const { nativeDocuments, textEditing } = createAppNativeDocuments(
    environmentId,
    account.accountService,
    () => deps,
    extensionStorageDBService,
    extensionRuntimeCatalog,
    work,
  );

  deps = {
    ...core,
    personalHistoryService: createAppPersonalHistory(extensionStorageDBService, {
      eventBus,
      account: account.accountService,
      projects: projectService,
      logs: createSessionLogFiles(storageRoot),
    }),
    accountService: account.accountService,
    environmentService: dbs.environmentDBService,
    storagePositions,
    projectRecovery: { root: join(storageRoot, "folder-recovery") },
    artifactMountWrites,
    resourceLinksService: dbs.resourceLinksDBService,
    extensionResourceSequencesService: dbs.extensionResourceSequencesDBService,
    projectInfoService: dbs.projectInfoDBService,
    extensionWebviewAccess: createExtensionWebviewAccess(),
    readiness: { database: true, storage: true },
    eventBus,
    automationService,
    sessionQueueEntriesService,
    sessionQueueLifecycle,
    sessionService,
    sessionImports: createSessionImportService(
      { sessionService, fileService, projectService, workspaceService },
      join(storageRoot, "session-imports"),
    ),
    settingsService,
    workspaceCapacityService,
    skillService,
    boardViewsService: boardViewsDBService,
    nativeDocuments,
    textEditing,
    installedExtensionSourcesService: installedExtensionSourcesDBService,
    ...extensionDeps,
    extensionRuntimeCatalog,
    webviewPreferencesDBService: dbs.webviewPreferencesDBService,
    extensionSettingsDBService,
    preferencesDBService: dbs.preferencesDBService,
    extensionStorageService: extensionStorageDBService,
    activityEventsService: activityEventsDBService,
    ensureExtensionWebviews: extensionRuntime.ensureWebviews,
    terminal: terminalSupervisor.api,
  };

  await deps.nativeDocuments.recover();
  await automationService.recoverInterruptedRuns();

  const extensionScheduler = startAppExtensionScheduler(deps, projectService, storageRoot);
  const artifactMountWatch = startAppArtifactMountWatch(deps, projectService);
  const notificationWakeTimer = startNotificationWakeTimer(notificationService);
  let stopDeadRowCleanup = async () => {};

  try {
    registerBenchmarkCounters(app, db, runtimeHost);
    registerAppRuntime(app, deps, input, {
      extensionScheduler,
      host: runtimeHost,
      sessionService,
      terminalSupervisor,
    });

    sessions.connectQueueDrain();
    sessions.connectIdleTurn((sessionId) => deliverIdleFollowUp(deps, sessionId));

    const close = await startAppLifecycle({
      deps,
      closeSessionHooks: sessions.closeHooks,
      notificationWakeTimer,
      stopDeadRowCleanup: () => stopDeadRowCleanup(),
      unsubscribeExtensionEvents,
      extensionRuntime,
      extensionStartup,
      extensionScheduler,
      artifactMountWatch,
      automationService,
      terminalSupervisor,
      closeDb: () => closeAppDatabase(deps, closeDb),
    });
    const connected = await account.connectAccountRelay({ app, close, deps, eventBus });
    stopDeadRowCleanup = startAppDeadRowCleanup(database, requestQuietPeriod.isQuiet);
    return { ...connected, extensionsReady: extensionStartup };
  } catch (error) {
    // createApp closes the database on a failed startup; the cleanup must not outlive it.
    await stopDeadRowCleanup();
    throw error;
  }
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
