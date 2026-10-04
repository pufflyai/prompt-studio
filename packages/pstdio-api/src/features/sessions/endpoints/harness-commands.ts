import { createRoute, z } from "@hono/zod-openapi";
import { harnessCommandStateSchema, harnessOperationSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import {
  getSessionHarnessCommands,
  HarnessOperationError,
  invokeSessionHarnessOperation,
} from "../session-harness-commands";

const request = { query: z.object({}).strict(), params: z.object({ id: z.string() }).strict() };
const errors = {
  400: {
    description: "Unsupported or invalid operation.",
    content: { "application/json": { schema: z.object({ error: z.string() }) } },
  },
  404: {
    description: "Session not found.",
    content: { "application/json": { schema: z.object({ error: z.string() }) } },
  },
  409: {
    description: "Conflicting work.",
    content: { "application/json": { schema: z.object({ error: z.string() }) } },
  },
};
export const getHarnessCommandsRoute = createRoute({
  method: "get",
  path: "/sessions/{id}/harness-commands",
  tags: ["Sessions"],
  request,
  responses: {
    200: {
      description: "Native commands and current harness modes.",
      content: { "application/json": { schema: harnessCommandStateSchema.extend({ harnessId: z.string() }) } },
    },
    ...errors,
  },
});
export const invokeHarnessCommandRoute = createRoute({
  method: "post",
  path: "/sessions/{id}/harness-commands",
  tags: ["Sessions"],
  request: {
    ...request,
    body: {
      content: {
        "application/json": {
          schema: z.object({ operation: harnessOperationSchema, harnessId: z.string().optional() }).strict(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Operation completed or native work started.",
      content: {
        "application/json": {
          schema: z.object({ status: z.enum(["completed", "started"]), message: z.string().optional() }),
        },
      },
    },
    ...errors,
  },
});
export const getHarnessCommandsHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof getHarnessCommandsRoute> =>
  async (c) => {
    try {
      return c.json(await getSessionHarnessCommands(deps, c.req.valid("param").id), 200);
    } catch (error) {
      if (error instanceof HarnessOperationError) return c.json({ error: error.message }, error.status);
      throw error;
    }
  };
export const invokeHarnessCommandHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof invokeHarnessCommandRoute> =>
  async (c) => {
    const body = c.req.valid("json");
    try {
      return c.json(
        await invokeSessionHarnessOperation(
          deps,
          c.req.valid("param").id,
          body.operation,
          body.harnessId,
          c.req.raw.signal,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HarnessOperationError) return c.json({ error: error.message }, error.status);
      throw error;
    }
  };
