import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { createAgentRegistry, createClaudeCodeAgent, createOpencodeAgent } from "pstdio-agents";
import {
  createAgentConfigsService,
  createDb,
  createProjectsService,
  createReposService,
  createSessionsService,
  createStatusesService,
  createTagsService,
  createTemplatesService,
  createTicketsService,
  createWorkspacesService,
} from "pstdio-db";
import { createFilesService, createSkillsService, ensureStorageRoot, resolveStorageRoot } from "pstdio-storage";
import { createAgentRoutes } from "./features/agents/routes";
import { createHealthRoutes } from "./features/health/routes";
import { createProjectRoutes } from "./features/projects/routes";
import { createSessionRoutes } from "./features/sessions/routes";
import { createSessionStore } from "./features/sessions/session-store";
import { createSkillRoutes } from "./features/skills/routes";
import { createStatusRoutes } from "./features/statuses/routes";
import { EventBus } from "./features/sync/event-bus";
import { createSyncRoutes } from "./features/sync/routes";
import { createTagRoutes } from "./features/tags/routes";
import { createTemplateRoutes } from "./features/templates/routes";
import { createTicketRoutes } from "./features/tickets/routes";
import { createWorkspaceRoutes } from "./features/workspaces/routes";
import { logError, persistErrorLog } from "./lib/error-log";
import { swagger } from "./swagger";
import type { AppBindings } from "./types";

interface AppOptions {
  dbPath?: string;
  storagePath?: string;
}

export const createApp = async (options?: AppOptions) => {
  const { db, close: closeDb } = await createDb({ path: options?.dbPath ?? process.env.PSTDIO_DB_PATH });

  const storageRoot = options?.storagePath ?? resolveStorageRoot(process.env.PSTDIO_STORAGE_PATH);
  ensureStorageRoot(storageRoot);

  const projectsService = createProjectsService(db);
  const reposService = createReposService(db);
  const filesService = createFilesService(db, storageRoot);
  const skillsService = createSkillsService(reposService);

  const agentRegistry = createAgentRegistry([createClaudeCodeAgent(), createOpencodeAgent()]);

  const agentConfigsService = createAgentConfigsService(db);
  const templatesService = createTemplatesService(db);
  const sessionsService = createSessionsService(db);
  const ticketsService = createTicketsService(db);
  const workspacesService = createWorkspacesService(db);
  const statusesService = createStatusesService(db);
  const tagsService = createTagsService(db);
  const eventBus = new EventBus();
  const sessionStore = createSessionStore();

  const deps = {
    readiness: { database: true, storage: true },
    db,
    closeDb,
    eventBus,
    projectsService,
    reposService,
    agentConfigsService,
    filesService,
    sessionsService,
    skillsService,
    templatesService,
    ticketsService,
    workspacesService,
    statusesService,
    tagsService,
    agentRegistry,
    sessionStore,
  };

  const app = new OpenAPIHono<AppBindings>();

  app.use("*", cors());

  app.route("/", createHealthRoutes(deps));
  app.route("/v1", createProjectRoutes(deps));
  app.route("/v1", createAgentRoutes(deps));
  app.route("/v1", createSkillRoutes(deps));
  app.route("/v1", createTemplateRoutes(deps));
  app.route("/v1", createTicketRoutes(deps));
  app.route("/v1", createStatusRoutes(deps));
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

    logError(entry);
    persistErrorLog(entry);

    return c.json({ error: "Internal server error" }, 500);
  });

  swagger(app);

  return app;
};
