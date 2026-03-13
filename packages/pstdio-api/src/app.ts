import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import {
  type AgentId,
  type AgentService,
  createAgentRegistry,
  createClaudeCodeAgent,
  createFakeAgent,
  createOpencodeAgent,
} from "pstdio-agents";
import {
  createAgentConfigsService,
  createDb,
  createProjectsService,
  createReposService,
  createSessionsService,
  createSkillsDbService,
  createStatusesService,
  createTagsService,
  createTemplatesService,
  createTicketsService,
  createWorkspacesService,
} from "pstdio-db";
import {
  createChangelogService,
  createDocsService,
  createFilesService,
  createSkillsService,
  ensureStorageRoot,
  resolveStorageRoot,
} from "pstdio-storage";
import { createAgentRoutes } from "./features/agents/routes";
import { createChangelogRoutes } from "./features/changelog/routes";
import { createDocsRoutes } from "./features/docs/routes";
import { createFilesystemRoutes } from "./features/filesystem/routes";
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
  apiToken?: string;
  agents?: AgentService[];
}

const agentFactories: Record<AgentId, () => AgentService> = {
  "claude-code": createClaudeCodeAgent,
  opencode: createOpencodeAgent,
  fake: createFakeAgent,
};

const parseAgentIds = (value: string | undefined) =>
  value
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) ?? [];

const resolveDefaultAgents = (options?: AppOptions) => {
  if (options?.agents) return options.agents;

  const configuredAgentIds = parseAgentIds(process.env.PSTDIO_AGENTS);
  if (configuredAgentIds.length === 0) {
    return [createClaudeCodeAgent(), createOpencodeAgent()];
  }

  const ids = [...new Set(configuredAgentIds)];
  return ids.map((id) => {
    const factory = agentFactories[id as AgentId];
    if (!factory) throw new Error(`Unsupported agent in PSTDIO_AGENTS: ${id}`);
    return factory();
  });
};

export const createApp = async (options?: AppOptions) => {
  const { db, close: closeDb } = await createDb({ path: options?.dbPath ?? process.env.PSTDIO_DB_PATH });
  const apiToken = options?.apiToken ?? process.env.PSTDIO_API_TOKEN;

  const storageRoot = options?.storagePath ?? resolveStorageRoot(process.env.PSTDIO_STORAGE_PATH);
  ensureStorageRoot(storageRoot);

  const projectsService = createProjectsService(db);
  const reposService = createReposService(db);
  const filesService = createFilesService(db, storageRoot);
  const skillsService = createSkillsService(reposService);

  const docsService = createDocsService(reposService);
  const changelogService = createChangelogService(reposService);
  const agentRegistry = createAgentRegistry(resolveDefaultAgents(options));

  const agentConfigsService = createAgentConfigsService(db);
  const skillsDbService = createSkillsDbService(db);
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
    docsService,
    changelogService,
    agentConfigsService,
    filesService,
    sessionsService,
    skillsService,
    skillsDbService,
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
  app.route("/v1", createDocsRoutes(deps));
  app.route("/v1", createChangelogRoutes(deps));
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

  return { app, close: closeDb };
};
