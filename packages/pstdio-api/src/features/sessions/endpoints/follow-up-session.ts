import { createRoute, z } from "@hono/zod-openapi";
import type { FollowUpDecision } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { followUpBodySchema, followUpResponseSchema, notFoundResponseSchema } from "../dto";
import { HarnessParamError } from "../harness-params";
import { questionReplyRejection } from "../live-question-reply";
import { sendSessionFollowUp } from "../send-session-followup";
import { SessionAttachmentError } from "../session-attachments";
import { toSessionResponse } from "../session-response";

export const followUpSessionRoute = createRoute({
  method: "post",
  path: "/sessions/{id}/follow-up",
  description: "Send a follow-up prompt to an existing session.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    params: z.object({ id: z.string() }).strict(),
    body: {
      content: { "application/json": { schema: followUpBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Follow-up accepted.",
      content: { "application/json": { schema: followUpResponseSchema } },
    },
    400: {
      description: "Invalid follow-up request.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    404: {
      description: "Session not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

const followUpError = (error: unknown) => {
  if (
    !(error instanceof SessionAttachmentError) &&
    !(error instanceof HarnessParamError) &&
    !questionReplyRejection(error)
  )
    throw error;
  return { error: error instanceof Error ? error.message : String(error) };
};

const toCanonicalDecision = (decision: FollowUpDecision) => {
  if (decision.status === "queued") return { status: decision.status, queuePosition: decision.queue_position };
  return decision;
};

export const followUpSessionHandler = (deps: SessionsRouteDeps): AppRouteHandler<typeof followUpSessionRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const session = await deps.sessionService.get(id);
    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    try {
      const decision = await sendSessionFollowUp(deps, session, input);
      const result = await deps.sessionService.get(session.id);
      if (!result) {
        return c.json({ error: `Session not found: ${id}` }, 404);
      }
      return c.json(
        {
          ...toSessionResponse(
            result,
            (await deps.workspaceSessionService.getWorkspaceBySessionId(result.id))?.id ?? null,
          ),
          followUp: toCanonicalDecision(decision),
          follow_up: decision,
        },
        200,
      );
    } catch (error) {
      return c.json(followUpError(error), 400);
    }
  };
};
