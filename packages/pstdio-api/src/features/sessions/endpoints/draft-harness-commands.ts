import { createRoute, z } from "@hono/zod-openapi";
import { draftHarnessCommandInputSchema, harnessCommandStateSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { ProjectFolderMissingError } from "../../projects/project-folder-missing";
import type { SessionsRouteDeps } from "../deps";
import { getDraftHarnessCommands } from "../draft-harness-commands";
import { HarnessParamError } from "../harness-params";
import { HarnessOperationError } from "../session-harness-commands";

const errorResponse = {
  description: "Project, harness, workspace, or parameters are unavailable.",
  content: { "application/json": { schema: z.object({ error: z.string() }) } },
};
const conflictResponse = {
  description: "The workspace is not ready, or the project's folder is not on this device.",
  content: { "application/json": { schema: z.object({ error: z.string(), code: z.string().optional() }) } },
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
    409: conflictResponse,
  },
});

export const draftHarnessCommandsHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof draftHarnessCommandsRoute> =>
  async (c) => {
    try {
      return c.json(await getDraftHarnessCommands(deps, c.req.valid("json")), 200);
    } catch (error) {
      if (error instanceof HarnessOperationError) return c.json({ error: error.message }, error.status);
      if (error instanceof ProjectFolderMissingError) return c.json({ error: error.message, code: error.code }, 409);
      if (error instanceof HarnessParamError) return c.json({ error: error.message }, 400);
      throw error;
    }
  };
