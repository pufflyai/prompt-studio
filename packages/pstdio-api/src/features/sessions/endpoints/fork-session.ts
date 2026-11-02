import { createRoute, z } from "@hono/zod-openapi";
import { sessionCreateResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { ProjectFolderMissingError } from "../../projects/project-folder-missing";
import type { SessionsRouteDeps } from "../deps";
import { forkSession, SessionForkError } from "../fork-session";
import { toSessionResponse } from "../session-response";

const error = { content: { "application/json": { schema: z.object({ error: z.string() }) } } };
export const forkSessionRoute = createRoute({
  method: "post",
  path: "/sessions/{id}/fork",
  description:
    "Copy a settled conversation into an independent session in the same workspace without running the agent.",
  tags: ["Sessions"],
  request: { params: z.object({ id: z.string() }).strict(), query: z.object({}).strict() },
  responses: {
    201: {
      description: "Conversation forked.",
      content: { "application/json": { schema: sessionCreateResponseSchema } },
    },
    400: { description: "The harness cannot fork conversations.", ...error },
    404: { description: "Session not found.", ...error },
    409: { description: "The conversation or workspace is not ready.", ...error },
  },
});
export const forkSessionHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof forkSessionRoute> =>
  async (c) => {
    try {
      const result = await forkSession(deps, c.req.valid("param").id);
      return c.json({ ...result.session, ...toSessionResponse(result.session, result.workspaceId) }, 201);
    } catch (error) {
      if (error instanceof SessionForkError) return c.json({ error: error.message }, error.status);
      if (error instanceof ProjectFolderMissingError) return c.json({ error: error.message }, 409);
      throw error;
    }
  };
