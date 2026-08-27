import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  automationRunSchema,
  createAutomationRunInputSchema,
  issueAutomationTokenInputSchema,
  issueAutomationTokenResponseSchema,
  listAutomationRunEventsResponseSchema,
  listAutomationTokensResponseSchema,
} from "pstdio-api-contracts";
import type { AppBindings, AppRouteHandler } from "../../types";
import { AutomationRequestError, bearerTokenFrom } from "./automation-policy";
import type { AutomationRouteDeps } from "./deps";

const errorSchema = z.object({ error: z.string(), code: z.string() });
const projectRunParams = z.object({ projectId: z.string(), runId: z.string() }).strict();

const issueTokenRoute = createRoute({
  method: "post",
  path: "/auth/tokens",
  tags: ["Automation"],
  request: { body: { content: { "application/json": { schema: issueAutomationTokenInputSchema } } } },
  responses: {
    201: {
      description: "Machine token issued. The raw token is returned once.",
      content: { "application/json": { schema: issueAutomationTokenResponseSchema } },
    },
    400: { description: "Invalid token scope.", content: { "application/json": { schema: errorSchema } } },
  },
});

const listTokensRoute = createRoute({
  method: "get",
  path: "/auth/tokens",
  tags: ["Automation"],
  request: { query: z.object({ projectId: z.string() }).strict() },
  responses: {
    200: {
      description: "Machine tokens.",
      content: { "application/json": { schema: listAutomationTokensResponseSchema } },
    },
  },
});

const revokeTokenRoute = createRoute({
  method: "delete",
  path: "/auth/tokens/{tokenId}",
  tags: ["Automation"],
  request: { params: z.object({ tokenId: z.string() }).strict() },
  responses: {
    204: { description: "Machine token revoked." },
    404: { description: "Machine token not found.", content: { "application/json": { schema: errorSchema } } },
  },
});

const createRunRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/automation-runs",
  tags: ["Automation"],
  request: {
    params: z.object({ projectId: z.string() }).strict(),
    body: { content: { "application/json": { schema: createAutomationRunInputSchema } } },
  },
  responses: {
    202: {
      description: "Automation run accepted.",
      content: { "application/json": { schema: automationRunSchema } },
    },
    400: { description: "Invalid automation input.", content: { "application/json": { schema: errorSchema } } },
    401: { description: "Invalid machine token.", content: { "application/json": { schema: errorSchema } } },
    403: { description: "Machine token scope denied.", content: { "application/json": { schema: errorSchema } } },
    409: { description: "Idempotency key conflict.", content: { "application/json": { schema: errorSchema } } },
    413: {
      description: "Automation request body is too large.",
      content: { "application/json": { schema: errorSchema } },
    },
    429: {
      description: "Automation run rate limit exceeded.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const getRunRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/automation-runs/{runId}",
  tags: ["Automation"],
  request: { params: projectRunParams },
  responses: {
    200: { description: "Automation run.", content: { "application/json": { schema: automationRunSchema } } },
    401: { description: "Invalid machine token.", content: { "application/json": { schema: errorSchema } } },
    403: { description: "Machine token scope denied.", content: { "application/json": { schema: errorSchema } } },
    404: { description: "Automation run not found.", content: { "application/json": { schema: errorSchema } } },
    429: {
      description: "Authentication rate limit exceeded.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const listRunEventsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/automation-runs/{runId}/events",
  tags: ["Automation"],
  request: {
    params: projectRunParams,
    query: z.object({ after: z.coerce.number().int().nonnegative().default(0) }).strict(),
  },
  responses: {
    200: {
      description: "Automation run events.",
      content: { "application/json": { schema: listAutomationRunEventsResponseSchema } },
    },
    401: { description: "Invalid machine token.", content: { "application/json": { schema: errorSchema } } },
    403: { description: "Machine token scope denied.", content: { "application/json": { schema: errorSchema } } },
    404: { description: "Automation run not found.", content: { "application/json": { schema: errorSchema } } },
    429: {
      description: "Authentication rate limit exceeded.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const cancelRunRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/automation-runs/{runId}/cancel",
  tags: ["Automation"],
  request: { params: projectRunParams },
  responses: {
    200: { description: "Automation run cancelled.", content: { "application/json": { schema: automationRunSchema } } },
    401: { description: "Invalid machine token.", content: { "application/json": { schema: errorSchema } } },
    403: { description: "Machine token scope denied.", content: { "application/json": { schema: errorSchema } } },
    404: { description: "Automation run not found.", content: { "application/json": { schema: errorSchema } } },
    409: { description: "Automation run is still stopping.", content: { "application/json": { schema: errorSchema } } },
    429: {
      description: "Authentication rate limit exceeded.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const errorResponse = (error: unknown) => {
  if (error instanceof AutomationRequestError) {
    return { body: { error: error.message, code: error.code }, status: error.status } as const;
  }
  throw error;
};

const issueTokenHandler =
  (deps: AutomationRouteDeps): AppRouteHandler<typeof issueTokenRoute> =>
  async (c) => {
    try {
      return c.json(await deps.automationService.issueToken(c.req.valid("json")), 201);
    } catch (error) {
      const response = errorResponse(error);
      return c.json(response.body, response.status as 400);
    }
  };

const listTokensHandler =
  (deps: AutomationRouteDeps): AppRouteHandler<typeof listTokensRoute> =>
  async (c) =>
    c.json({ tokens: await deps.automationService.listTokens(c.req.valid("query").projectId) }, 200);

const revokeTokenHandler =
  (deps: AutomationRouteDeps): AppRouteHandler<typeof revokeTokenRoute> =>
  async (c) => {
    try {
      await deps.automationService.revokeToken(c.req.valid("param").tokenId);
      return c.body(null, 204);
    } catch (error) {
      const response = errorResponse(error);
      return c.json(response.body, 404);
    }
  };

const createRunHandler =
  (deps: AutomationRouteDeps): AppRouteHandler<typeof createRunRoute> =>
  async (c) => {
    try {
      const run = await deps.automationService.createRun({
        rawToken: bearerTokenFrom(c.req.raw),
        projectId: c.req.valid("param").projectId,
        idempotencyKey: c.req.header("idempotency-key") ?? null,
        body: c.req.valid("json"),
      });
      return c.json(run, 202);
    } catch (error) {
      const response = errorResponse(error);
      return c.json(response.body, response.status as 400 | 401 | 403 | 409 | 429);
    }
  };

const getRunHandler =
  (deps: AutomationRouteDeps): AppRouteHandler<typeof getRunRoute> =>
  async (c) => {
    try {
      const { projectId, runId } = c.req.valid("param");
      return c.json(await deps.automationService.getRun(bearerTokenFrom(c.req.raw), projectId, runId), 200);
    } catch (error) {
      const response = errorResponse(error);
      return c.json(response.body, response.status as 401 | 403 | 404 | 429);
    }
  };

const listRunEventsHandler =
  (deps: AutomationRouteDeps): AppRouteHandler<typeof listRunEventsRoute> =>
  async (c) => {
    try {
      const { projectId, runId } = c.req.valid("param");
      const events = await deps.automationService.listRunEvents(
        bearerTokenFrom(c.req.raw),
        projectId,
        runId,
        c.req.valid("query").after,
      );
      return c.json({ events }, 200);
    } catch (error) {
      const response = errorResponse(error);
      return c.json(response.body, response.status as 401 | 403 | 404 | 429);
    }
  };

const cancelRunHandler =
  (deps: AutomationRouteDeps): AppRouteHandler<typeof cancelRunRoute> =>
  async (c) => {
    try {
      const { projectId, runId } = c.req.valid("param");
      return c.json(await deps.automationService.cancelRun(bearerTokenFrom(c.req.raw), projectId, runId), 200);
    } catch (error) {
      const response = errorResponse(error);
      return c.json(response.body, response.status as 401 | 403 | 404 | 409 | 429);
    }
  };

export const createAutomationRoutes = (deps: AutomationRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.openapi(issueTokenRoute, issueTokenHandler(deps));
  routes.openapi(listTokensRoute, listTokensHandler(deps));
  routes.openapi(revokeTokenRoute, revokeTokenHandler(deps));
  routes.openapi(createRunRoute, createRunHandler(deps));
  routes.openapi(getRunRoute, getRunHandler(deps));
  routes.openapi(listRunEventsRoute, listRunEventsHandler(deps));
  routes.openapi(cancelRunRoute, cancelRunHandler(deps));
  return routes;
};
