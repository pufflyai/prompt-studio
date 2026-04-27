import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { createHarnessSessionBodySchema, notFoundResponseSchema, sessionResponse } from "../dto";
import { startHarnessSession } from "../session-flow";

const errorResponseSchema = z.object({ error: z.string() });

export const startHarnessSessionRoute = createRoute({
  method: "post",
  path: "/harnesses/sessions",
  description: "Create a new session and start a harness provider.",
  tags: ["Harnesses"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: createHarnessSessionBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Session created.",
      content: { "application/json": { schema: sessionResponse } },
    },
    400: {
      description: "Harness session could not be started.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Project, workspace, or harness not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const startHarnessSessionHandler = (deps: RouteDeps): AppRouteHandler<typeof startHarnessSessionRoute> => {
  return async (c) => {
    const result = await startHarnessSession(c.req.valid("json"), deps);
    if (result.type === "error") {
      return c.json({ error: result.error }, result.status);
    }

    return c.json(result.session, 201);
  };
};
