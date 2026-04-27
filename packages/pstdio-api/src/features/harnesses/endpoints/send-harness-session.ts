import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, sendHarnessSessionBodySchema, sessionResponse } from "../dto";
import { sendHarnessSession } from "../session-flow";

const conflictResponseSchema = z.object({ error: z.string() });

export const sendHarnessSessionRoute = createRoute({
  method: "post",
  path: "/harnesses/sessions/{id}/send",
  description: "Send a follow-up prompt to a harness-backed session.",
  tags: ["Harnesses"],
  request: {
    query: z.object({}).strict(),
    params: z.object({ id: z.string() }).strict(),
    body: {
      content: { "application/json": { schema: sendHarnessSessionBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Follow-up accepted.",
      content: { "application/json": { schema: sessionResponse } },
    },
    404: {
      description: "Session or harness not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    400: {
      description: "Harness session could not be sent.",
      content: { "application/json": { schema: conflictResponseSchema } },
    },
    409: {
      description: "Session is currently in progress.",
      content: { "application/json": { schema: conflictResponseSchema } },
    },
  },
});

export const sendHarnessSessionHandler = (deps: RouteDeps): AppRouteHandler<typeof sendHarnessSessionRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const result = await sendHarnessSession(id, c.req.valid("json"), deps);
    if (result.type === "error") {
      return c.json({ error: result.error }, result.status);
    }

    return c.json(result.session, 200);
  };
};
