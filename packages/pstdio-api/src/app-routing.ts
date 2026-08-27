import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import { redactSensitiveText } from "pstdio-logging";
import { createAgentRoutes } from "./features/agents/routes";
import { bearerTokenFrom, MAX_INPUT_BYTES } from "./features/automation/automation-policy";
import { createAutomationRoutes } from "./features/automation/routes";
import type { RouteDeps } from "./features/deps";
import { createExtensionWebviewAssetRoutes } from "./features/extensions/extension-webview-asset-routes";
import { createExtensionRoutes } from "./features/extensions/routes";
import { createFilesystemRoutes } from "./features/filesystem/routes";
import { createHealthRoutes } from "./features/health/routes";
import { createNotificationsRoutes } from "./features/notifications/routes";
import { createProjectRoutes } from "./features/projects/routes";
import { createRuntimeRoutes } from "./features/runtime/routes";
import {
  isRuntimeOriginAllowed,
  isRuntimeRequestAuthorized,
  type RuntimeSecurity,
  runtimeOrigin,
} from "./features/runtime/runtime-auth";
import { createSessionRoutes } from "./features/sessions/routes";
import { createSettingsRoutes } from "./features/settings/routes";
import { createSkillRoutes } from "./features/skills/routes";
import { createSyncRoutes } from "./features/sync/routes";
import { createTerminalRoutes } from "./features/terminal/routes";
import { createWorkspaceRoutes } from "./features/workspaces/routes";
import { apiLogger } from "./lib/logger";
import { swagger } from "./swagger";
import type { AppBindings } from "./types";

const isPublicPath = (path: string) => path === "/healthz" || path === "/ping";
const isMachineAutomationPath = (path: string) => /^\/v1\/projects\/[^/]+\/automation-runs(?:\/|$)/.test(path);
const isCreateAutomationPath = (method: string, path: string) =>
  method === "POST" && /^\/v1\/projects\/[^/]+\/automation-runs$/.test(path);

const automationBodyTooLarge = (c: Context<AppBindings>) =>
  c.json({ error: "Automation input is too large.", code: "invalid_automation_input" }, 413);

const enforceAutomationBodyLimit = async (c: Context<AppBindings>, next: Next) => {
  const contentLength = Number(c.req.header("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_INPUT_BYTES) return automationBodyTooLarge(c);
  if (!c.req.raw.body) return next();

  const chunks: Uint8Array[] = [];
  const reader = c.req.raw.body.getReader();
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_INPUT_BYTES) {
      await reader.cancel();
      return automationBodyTooLarge(c);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  c.req.raw = new Request(c.req.raw, { body });
  return next();
};

const registerSecureTransport = (app: OpenAPIHono<AppBindings>, security: RuntimeSecurity) => {
  app.use("*", async (c, next) => {
    if (isPublicPath(c.req.path)) {
      await next();
      return;
    }

    if (!isRuntimeOriginAllowed(c.req.raw, security)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const origin = c.req.header("origin");
    const expectedOrigin = runtimeOrigin(security);
    if (c.req.method === "OPTIONS") {
      if (!origin || origin !== expectedOrigin) return c.json({ error: "Forbidden" }, 403);
      c.header("access-control-allow-origin", origin);
      c.header("access-control-allow-credentials", "true");
      c.header("access-control-allow-headers", "content-type");
      c.header("access-control-allow-methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
      c.header("vary", "Origin");
      return c.body(null, 204);
    }

    await next();
    if (origin && origin === expectedOrigin) {
      c.header("access-control-allow-origin", origin);
      c.header("access-control-allow-credentials", "true");
      c.header("vary", "Origin");
    }
  });
};

const registerApiMiddleware = (
  app: OpenAPIHono<AppBindings>,
  deps: RouteDeps,
  security: RuntimeSecurity | undefined,
) => {
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

  app.use("*", (c, next) =>
    isCreateAutomationPath(c.req.method, c.req.path) ? enforceAutomationBodyLimit(c, next) : next(),
  );

  if (!security) {
    const permissiveCors = cors();
    app.use("*", permissiveCors);
    return;
  }

  registerSecureTransport(app, security);

  app.use("*", async (c, next) => {
    if (isPublicPath(c.req.path)) {
      await next();
      return;
    }
    if (!isMachineAutomationPath(c.req.path) && !isRuntimeRequestAuthorized(c.req.raw, security)) {
      await deps.automationService.auditDeniedRoute(bearerTokenFrom(c.req.raw), c.req.path).catch(() => undefined);
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });
};

const registerApiRoutes = (app: OpenAPIHono<AppBindings>, deps: RouteDeps, terminalOrigins: string[]) => {
  app.route("/", createHealthRoutes(deps));
  if (deps.runtime) app.route("/runtime", createRuntimeRoutes(deps.runtime));
  app.route("/v1", createProjectRoutes(deps));
  app.route("/v1", createAutomationRoutes(deps));
  app.route("/v1", createFilesystemRoutes(deps));
  app.route("/v1", createExtensionRoutes(deps));
  app.route("/v1", createAgentRoutes(deps));
  app.route("/v1", createSkillRoutes(deps));
  app.route("/v1", createNotificationsRoutes(deps));
  app.route("/v1", createSessionRoutes(deps));
  app.route("/v1", createSettingsRoutes(deps));
  app.route("/v1", createWorkspaceRoutes(deps));
  app.route("/v1", createSyncRoutes(deps));
  app.route("/v1", createTerminalRoutes(deps, { allowedOrigins: terminalOrigins }));
};

const registerApiErrorHandler = (app: OpenAPIHono<AppBindings>, security: RuntimeSecurity | undefined) => {
  app.onError((err, c) => {
    const secrets = security ? [security.token] : [];
    const message = redactSensitiveText(err.message || "Internal server error", secrets);
    const entry = {
      level: "error" as const,
      timestamp: new Date().toISOString(),
      method: c.req.method,
      path: c.req.path,
      status: 500,
      message,
      stack: err.stack ? redactSensitiveText(err.stack, secrets) : undefined,
    };

    apiLogger.error({ event: "api.request.error", ...entry }, "API request failed");

    return c.json({ code: "internal_server_error", error: message }, 500);
  });
};

export const registerApi = (
  app: OpenAPIHono<AppBindings>,
  deps: RouteDeps,
  input: { security: RuntimeSecurity | undefined; terminalOrigins: string[] },
) => {
  app.route("/v1", createExtensionWebviewAssetRoutes(deps));
  registerApiMiddleware(app, deps, input.security);
  registerApiRoutes(app, deps, input.terminalOrigins);
  registerApiErrorHandler(app, input.security);
  swagger(app);
};
