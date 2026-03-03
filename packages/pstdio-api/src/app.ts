import { OpenAPIHono } from "@hono/zod-openapi";
import { createAgentRegistry, createClaudeCodeAgent, createOpencodeAgent } from "pstdio-agents";
import { createAgentConfigsService, createDb, createProjectsService, createReposService } from "pstdio-db";
import { createFilesService, createSkillsService, ensureStorageRoot, resolveStorageRoot } from "pstdio-storage";
import { createAgentRoutes } from "./features/agents/routes";
import { createHealthRoutes } from "./features/health/routes";
import { createProjectRoutes } from "./features/projects/routes";
import { createSkillRoutes } from "./features/skills/routes";
import { EventBus } from "./features/sync/event-bus";
import { createSyncRoutes } from "./features/sync/routes";
import { swagger } from "./swagger";
import type { AppBindings } from "./types";

interface AppOptions {
  dbPath?: string;
  storagePath?: string;
}

export const createApp = async (options?: AppOptions) => {
  const { db } = await createDb({ path: options?.dbPath ?? process.env.PSTDIO_DB_PATH });

  const storageRoot = options?.storagePath ?? resolveStorageRoot(process.env.PSTDIO_STORAGE_PATH);
  ensureStorageRoot(storageRoot);

  const projectsService = createProjectsService(db);
  const reposService = createReposService(db);
  const filesService = createFilesService(db, storageRoot);
  const skillsService = createSkillsService(reposService);

  const agentRegistry = createAgentRegistry([createClaudeCodeAgent(), createOpencodeAgent()]);

  const agentConfigsService = createAgentConfigsService(db);
  const eventBus = new EventBus();

  const deps = {
    readiness: { database: true, storage: true },
    db,
    eventBus,
    projectsService,
    reposService,
    agentConfigsService,
    filesService,
    skillsService,
    agentRegistry,
  };

  const app = new OpenAPIHono<AppBindings>();

  app.route("/", createHealthRoutes(deps));
  app.route("/v1", createProjectRoutes(deps));
  app.route("/v1", createAgentRoutes(deps));
  app.route("/v1", createSkillRoutes(deps));
  app.route("/v1", createSyncRoutes(deps));

  swagger(app);

  return app;
};
