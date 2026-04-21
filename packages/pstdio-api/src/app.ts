import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { type AgentService, createAgentRegistry, resolveDefaultAgents } from "pstdio-agents";
import {
  createAgentConfigsDBService,
  createAttemptStatusesDBService,
  createDb,
  createFilesDBService,
  createProjectsDBService,
  createReposDBService,
  createSessionsDBService,
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
import { createActionRoutes } from "./features/actions/routes";
import { createAgentRoutes } from "./features/agents/routes";
import { createAttemptStatusRoutes } from "./features/attempt-statuses/routes";
import { createFilesystemRoutes } from "./features/filesystem/routes";
import { createHealthRoutes } from "./features/health/routes";
import { fireSessionResumeHook, fireSessionStartHook, fireSessionStatusHook } from "./features/hooks/session-hooks";
import { fireTicketHook, fireTicketHookAsync } from "./features/hooks/ticket-hooks";
import { createPluginService } from "./features/plugins/plugin-service";
import { createPluginRoutes } from "./features/plugins/routes";
import { createProjectRoutes } from "./features/projects/routes";
import { createSessionRoutes } from "./features/sessions/routes";
import { createSkillRoutes } from "./features/skills/routes";
import { createStatusRoutes } from "./features/statuses/routes";
import { EventBus } from "./features/sync/event-bus";
import { createSyncRoutes } from "./features/sync/routes";
import { createTagRoutes } from "./features/tags/routes";
import { createTemplateRoutes } from "./features/templates/routes";
import { createTicketRoutes } from "./features/tickets/routes";
import { createWorkspaceRoutes } from "./features/workspaces/routes";
import { apiLogger } from "./lib/logger";
import { createAgentConfigService } from "./services/agent-config-service";
import { createAttemptStatusService } from "./services/attempt-status-service";
import { createFileService } from "./services/file-service";
import { createProjectService } from "./services/project-service";
import { createRepoService } from "./services/repo-service";
import { createSessionService } from "./services/session-service";
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
import { swagger } from "./swagger";
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
  const templateService = createTemplateService({ templatesDBService });
  const attemptStatusService = createAttemptStatusService({ attemptStatusesDBService });
  const agentConfigService = createAgentConfigService({ agentConfigsDBService });
  const skillService = createSkillService({ skillsDBService, skillsStorageService });
  const fileService = createFileService({ filesDBService, filesStorageService });
  const syncService = createSyncService({ db, eventBus });

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

  const sessionService = createSessionService({
    sessionsDb: sessionsDBService,
    eventBus,
    onSessionStarted: (session) => fireSessionStartHook(sessionHookDeps, session),
    onSessionStatusChanged: (session) => fireSessionStatusHook(sessionHookDeps, session),
    onSessionResumed: (session) => fireSessionResumeHook(sessionHookDeps, session),
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
    syncService,
    pluginService,
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

  app.route("/", createHealthRoutes(deps));
  app.route("/v1", createProjectRoutes(deps));
  app.route("/v1", createFilesystemRoutes(deps));
  app.route("/v1", createActionRoutes(deps));
  app.route("/v1", createPluginRoutes(deps));
  app.route("/v1", createAgentRoutes(deps));
  app.route("/v1", createSkillRoutes(deps));
  app.route("/v1", createTemplateRoutes(deps));
  app.route("/v1", createTicketRoutes(deps));
  app.route("/v1", createStatusRoutes(deps));
  app.route("/v1", createAttemptStatusRoutes(deps));
  app.route("/v1", createSessionRoutes(deps));
  app.route("/v1", createWorkspaceRoutes(deps));
  app.route("/v1", createTagRoutes(deps));
  app.route("/v1", createSyncRoutes(deps));

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
    await closeDb();
  };

  return { app, close, deps, eventBus };
};
