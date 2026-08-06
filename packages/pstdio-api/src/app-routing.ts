import type { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { createAgentRoutes } from "./features/agents/routes";
import type { RouteDeps } from "./features/deps";
import { createExtensionRoutes } from "./features/extensions/routes";
import { createFilesystemRoutes } from "./features/filesystem/routes";
import { createHealthRoutes } from "./features/health/routes";
import { createNotificationsRoutes } from "./features/notifications/routes";
import { createProjectRoutes } from "./features/projects/routes";
import { createRuntimeRoutes } from "./features/runtime/routes";
import { createSessionRoutes } from "./features/sessions/routes";
import { createSettingsRoutes } from "./features/settings/routes";
import { createSkillRoutes } from "./features/skills/routes";
import { createSyncRoutes } from "./features/sync/routes";
import { createTemplateRoutes } from "./features/templates/routes";
import { createTerminalRoutes } from "./features/terminal/routes";
import { createWorkspaceRoutes } from "./features/workspaces/routes";
import { apiLogger } from "./lib/logger";
import { swagger } from "./swagger";
import type { AppBindings } from "./types";

const registerApiMiddleware = (app: OpenAPIHono<AppBindings>, apiToken: string | undefined) => {
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

  if (!apiToken) return;

  app.use("/v1/*", async (c, next) => {
    const authorization = c.req.header("authorization");
    if (!authorization || !/^bearer\s+/i.test(authorization)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const token = authorization.replace(/^bearer\s+/i, "").trim();
    if (token !== apiToken) return c.json({ error: "Unauthorized" }, 401);
    await next();
  });
};

const registerApiRoutes = (app: OpenAPIHono<AppBindings>, deps: RouteDeps) => {
  app.route("/", createHealthRoutes(deps));
  if (deps.runtime) app.route("/runtime", createRuntimeRoutes(deps.runtime));
  app.route("/v1", createProjectRoutes(deps));
  app.route("/v1", createFilesystemRoutes(deps));
  app.route("/v1", createExtensionRoutes(deps));
  app.route("/v1", createAgentRoutes(deps));
  app.route("/v1", createSkillRoutes(deps));
  app.route("/v1", createTemplateRoutes(deps));
  app.route("/v1", createNotificationsRoutes(deps));
  app.route("/v1", createSessionRoutes(deps));
  app.route("/v1", createSettingsRoutes(deps));
  app.route("/v1", createWorkspaceRoutes(deps));
  app.route("/v1", createSyncRoutes(deps));
  app.route("/v1", createTerminalRoutes(deps));
};

const registerApiErrorHandler = (app: OpenAPIHono<AppBindings>) => {
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

    return c.json({ code: "internal_server_error", error: err.message || "Internal server error" }, 500);
  });
};

export const registerApi = (
  app: OpenAPIHono<AppBindings>,
  deps: RouteDeps,
  input: { apiToken: string | undefined },
) => {
  registerApiMiddleware(app, input.apiToken);
  registerApiRoutes(app, deps);
  registerApiErrorHandler(app);
  swagger(app);
};
