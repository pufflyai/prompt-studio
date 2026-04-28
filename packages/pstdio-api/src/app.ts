import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { type AgentService, createAgentRegistry, resolveDefaultAgents } from "pstdio-agents";
import {
  createAgentConfigsDBService,
  createAttemptStatusesDBService,
  createDb,
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createFilesDBService,
  createProjectsDBService,
  createReposDBService,
  createSessionsDBService,
  createSkillsDBService,
  createTemplatesDBService,
  createWorkspaceSessionsDBService,
  createWorkspacesDBService,
} from "pstdio-db";
import {
  createFilesStorageService,
  createSkillsStorageService,
  ensureStorageRoot,
  resolveStorageRoot,
} from "pstdio-storage";
import { createActionRoutes } from "./features/actions/routes";
import { createAttemptStatusRoutes } from "./features/attempt-statuses/routes";
import type { RouteDeps } from "./features/deps";
import { createExtensionCommandRoutes } from "./features/extension-commands/routes";
import { createExtensionRoutes } from "./features/extensions/routes";
import { createFileRoutes } from "./features/files/routes";
import { createFilesystemRoutes } from "./features/filesystem/routes";
import { createHarnessRoutes } from "./features/harnesses/routes";
import { createHealthRoutes } from "./features/health/routes";
import { fireSessionResumeHook, fireSessionStartHook, fireSessionStatusHook } from "./features/hooks/session-hooks";
import { createPluginService } from "./features/plugins/plugin-service";
import { createPluginRoutes } from "./features/plugins/routes";
import { createProjectRoutes } from "./features/projects/routes";
import { createSessionRoutes } from "./features/sessions/routes";
import { createSkillRoutes } from "./features/skills/routes";
import { EventBus } from "./features/sync/event-bus";
import { createSyncRoutes } from "./features/sync/routes";
import { createTemplateRoutes } from "./features/templates/routes";
import { createWorkspaceRoutes } from "./features/workspaces/routes";
import { apiLogger } from "./lib/logger";
import { createAgentConfigService } from "./services/agent-config-service";
import { createAttemptStatusService } from "./services/attempt-status-service";
import { createExtensionActionService } from "./services/extension-action-service";
import { createExtensionCommandService } from "./services/extension-command-service";
import { createExtensionInstanceService } from "./services/extension-instance-service";
import { createExtensionSetupService } from "./services/extension-setup-service";
import { createExtensionStorageService } from "./services/extension-storage-service";
import { createFileService } from "./services/file-service";
import { createHarnessProviderService } from "./services/harness-provider-service";
import { createProjectService } from "./services/project-service";
import { createRepoService } from "./services/repo-service";
import { createSessionService } from "./services/session-service";
import { createSkillRegistryService } from "./services/skill-registry-service";
import { createSkillService } from "./services/skill-service";
import { createSyncService } from "./services/sync-service";
import { createTemplateRegistryService } from "./services/template-registry-service";
import { createTemplateService } from "./services/template-service";
import { createWorkspaceService } from "./services/workspace-service";
import { createWorkspaceSessionService } from "./services/workspace-session-service";
import { runStartupTasks } from "./startup";
import { swagger } from "./swagger";
import type { AppBindings } from "./types";

interface AppOptions {
  dbPath?: string;
  storagePath?: string;
  filesRoot: string;
  apiToken?: string;
  agents?: AgentService[];
  eventBusBufferSize?: number;
  // When undefined, no scheduler runs. Production callers should set 60_000.
  // Tests that don't exercise scheduling leave this off so the per-test app
  // isn't dragging a background tick through every hook fire.
  schedulerTickMs?: number;
}

const resolveEventBusBufferSize = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return Math.floor(parsed);
};

const registerRoutes = (app: OpenAPIHono<AppBindings>, deps: RouteDeps) => {
  app.route("/", createHealthRoutes(deps));
  app.route("/v1", createProjectRoutes(deps));
  app.route("/v1", createFilesystemRoutes(deps));
  app.route("/v1", createActionRoutes(deps));
  app.route("/v1", createExtensionCommandRoutes(deps));
  app.route("/v1", createExtensionRoutes(deps));
  app.route("/v1", createFileRoutes(deps));
  app.route("/v1", createHarnessRoutes(deps));
  app.route("/v1", createPluginRoutes(deps));
  app.route("/v1", createSkillRoutes(deps));
  app.route("/v1", createTemplateRoutes(deps));
  app.route("/v1", createAttemptStatusRoutes(deps));
  app.route("/v1", createSessionRoutes(deps));
  app.route("/v1", createWorkspaceRoutes(deps));
  app.route("/v1", createSyncRoutes(deps));
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
  const sessionsDBService = createSessionsDBService(db);
  const workspacesDBService = createWorkspacesDBService(db);
  const workspaceSessionsDBService = createWorkspaceSessionsDBService(db);
  const attemptStatusesDBService = createAttemptStatusesDBService(db);
  const agentConfigsDBService = createAgentConfigsDBService(db);
  const skillsDBService = createSkillsDBService(db);
  const templatesDBService = createTemplatesDBService(db);
  const filesDBService = createFilesDBService(db);
  const extensionInstancesDBService = createExtensionInstancesDBService(db);
  const extensionStorageDBService = createExtensionStorageDBService(db);

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
  const templateService = createTemplateService({ templatesDBService });
  const attemptStatusService = createAttemptStatusService({ attemptStatusesDBService });
  const agentConfigService = createAgentConfigService({ agentConfigsDBService });
  const extensionInstanceService = createExtensionInstanceService({ extensionInstancesDBService });
  const extensionStorageService = createExtensionStorageService({ eventBus, extensionStorageDBService });
  const skillService = createSkillService({ skillsDBService, skillsStorageService });
  const fileService = createFileService({ filesDBService, filesStorageService });
  const templateRegistryService = createTemplateRegistryService({
    db,
    eventBus,
    extensionInstancesDBService,
    fileService,
    filesRoot: options.filesRoot,
    repoService,
    templateService,
  });
  const skillRegistryService = createSkillRegistryService({
    agentConfigService,
    db,
    eventBus,
    extensionInstancesDBService,
    filesRoot: options.filesRoot,
    repoService,
    skillService,
  });
  const syncService = createSyncService({ db, eventBus });
  const harnessProviderService = createHarnessProviderService({
    db,
    extensionInstancesDBService,
    filesRoot: options.filesRoot,
    repoService,
  });

  const workspaceSessionService = createWorkspaceSessionService({ workspaceSessionsDBService });
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
    schedulerTickMs: options.schedulerTickMs,
  });

  const sessionHookDeps = {
    reposService: repoService,
    workspaceSessionsService: workspaceSessionService,
    attemptStatusesService: attemptStatusService,
    pluginService,
  };

  const sessionService = createSessionService({
    sessionsDb: sessionsDBService,
    eventBus,
    onSessionStarted: (session) => fireSessionStartHook(sessionHookDeps, session),
    onSessionStatusChanged: (session) => fireSessionStatusHook(sessionHookDeps, session),
    onSessionResumed: (session) => fireSessionResumeHook(sessionHookDeps, session),
  });

  const extensionCommandService = createExtensionCommandService({
    agentConfigService,
    agentRegistry,
    db,
    eventBus,
    extensionInstancesDBService,
    fileService,
    projectService,
    repoService,
    sessionService,
    templateService,
    workspaceService,
    workspaceSessionService,
  });
  const extensionSetupService = createExtensionSetupService({ db, eventBus });
  const extensionActionService = createExtensionActionService({
    extensionCommandService,
    extensionInstanceService,
    filesRoot: options.filesRoot,
    repoService,
    sessionService,
    workspaceService,
  });

  // --- ONLY DOMAIN SERVICES ARE PASSED TO ROUTES ---
  const deps = {
    filesRoot: options.filesRoot,
    readiness: { database: true, storage: true },
    closeDb,
    eventBus,
    agentRegistry,
    projectService,
    repoService,
    sessionService,
    workspaceService,
    workspaceSessionService,
    templateService,
    templateRegistryService,
    attemptStatusService,
    agentConfigService,
    extensionInstanceService,
    extensionStorageService,
    skillService,
    skillRegistryService,
    fileService,
    harnessProviderService,
    syncService,
    extensionActionService,
    pluginService,
    extensionCommandService,
    extensionSetupService,
  };

  app.use("*", cors());
  app.use("*", async (c, next) => {
    const start = performance.now();
    try {
      await next();
    } finally {
      apiLogger.info(
        {
          duration_ms: Math.round(performance.now() - start),
          event: "api.request.completed",
          method: c.req.method,
          path: c.req.path,
          request_id: c.req.header("x-request-id"),
          status: c.res.status,
        },
        "API request completed",
      );
    }
  });

  if (apiToken) {
    app.use("/v1/*", async (c, next) => {
      const authorization = c.req.header("authorization");

      if (!authorization || !/^bearer\s+/i.test(authorization)) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const token = authorization.replace(/^bearer\s+/i, "").trim();

      if (token !== apiToken) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      await next();
    });
  }

  registerRoutes(app, deps);

  app.onError((err, c) => {
    const entry = {
      level: "error" as const,
      timestamp: new Date().toISOString(),
      method: c.req.method,
      path: c.req.path,
      status: 500,
      message: err.message,
      stack: err.stack,
    };

    apiLogger.error({ event: "api.request.error", ...entry }, "API request failed");

    return c.json({ error: "Internal server error" }, 500);
  });

  swagger(app);

  const startupAbort = new AbortController();
  const startupDone = runStartupTasks(deps, startupAbort.signal).catch((err) =>
    apiLogger.error({ err, event: "api.startup.error" }, "Startup task failed"),
  );

  const close = async () => {
    startupAbort.abort();
    await startupDone;
    await pluginService.dispose();
    await closeDb();
  };

  return { app, close, deps, eventBus };
};
