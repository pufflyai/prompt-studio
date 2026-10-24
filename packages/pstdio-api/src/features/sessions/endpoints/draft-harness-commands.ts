import { createRoute, z } from "@hono/zod-openapi";
import { draftHarnessCommandInputSchema, harnessCommandStateSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { getDraftHarnessCommands } from "../draft-harness-commands";
import { HarnessParamError } from "../harness-params";
import { HarnessOperationError } from "../session-harness-commands";

const errorResponse = {
  description: "Project, harness, workspace, or parameters are unavailable.",
  content: { "application/json": { schema: z.object({ error: z.string() }) } },
};
export const draftHarnessCommandsRoute = createRoute({
  method: "post",
  path: "/sessions/harness-command-state",
  tags: ["Sessions"],
  description: "Discover native commands for a new conversation without creating a session.",
  request: { body: { content: { "application/json": { schema: draftHarnessCommandInputSchema } } } },
  responses: {
    200: {
      description: "Selected harness commands and modes.",
      content: { "application/json": { schema: harnessCommandStateSchema.extend({ harnessId: z.string() }) } },
    },
    400: errorResponse,
    404: errorResponse,
    409: errorResponse,
  },
});

export const draftHarnessCommandsHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof draftHarnessCommandsRoute> =>
  async (c) => {
    try {
      return c.json(await getDraftHarnessCommands(deps, c.req.valid("json")), 200);
    } catch (error) {
      if (error instanceof HarnessOperationError) return c.json({ error: error.message }, error.status);
      if (error instanceof HarnessParamError) return c.json({ error: error.message }, 400);
      throw error;
    }
  };
