import { createRoute, z } from "@hono/zod-openapi";
import type { HarnessAttachment } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { composeSummary } from "../compose-summary";
import type { SessionsRouteDeps } from "../deps";
import { followUpBodySchema, followUpResponseSchema, notFoundResponseSchema } from "../dto";
import { getSessionMessages } from "../get-session-messages";
import { resolvePrompt } from "../resolve-prompt";
import { SessionAttachmentError, withResolvedSubmittingSessionAttachments } from "../session-attachments";
import { createSessionScheduler } from "../session-scheduler";

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

const buildFollowUpPrompt = async (
  input: {
    prompt?: string;
    template?: string;
    vars?: Record<string, string>;
    summary_from_session_id?: string;
    summary_format?: "brief" | "detailed";
    summary_role?: "assistant" | "all";
  },
  projectId: string,
  deps: SessionsRouteDeps,
) => {
  let prompt = await resolvePrompt(input, projectId, deps);

  if (input.summary_from_session_id) {
    const messages = await getSessionMessages(input.summary_from_session_id, deps);
    const summary = composeSummary(messages, {
      format: input.summary_format ?? "brief",
      role: input.summary_role ?? "assistant",
    });

    if (summary) {
      const block = `<session-summary>\n${summary}\n</session-summary>`;
      prompt = prompt ? `${prompt}\n\n${block}` : block;
    }
  }

  return prompt;
};

export const followUpSessionHandler = (deps: SessionsRouteDeps): AppRouteHandler<typeof followUpSessionRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const session = await deps.sessionService.get(id);
    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    const prompt = await buildFollowUpPrompt(input, session.project_id!, deps);
    const cwd = session.cwd!;
    const scheduler = createSessionScheduler(deps);

    try {
      const decision = await withResolvedSubmittingSessionAttachments(
        deps,
        session.project_id!,
        input.attachments,
        async (attachments: HarnessAttachment[]) =>
          scheduler.startOrQueueExisting({
            session,
            prompt,
            cwd,
            agentId: input.agent,
            model: input.model?.trim() || undefined,
            respectCapacity: true,
            questionResponse: input.question_response,
            attachments,
            attachmentRefs: input.attachments,
          }),
      );
      const result = await deps.sessionService.get(session.id);
      if (!result) {
        return c.json({ error: `Session not found: ${id}` }, 404);
      }
      return c.json({ ...result, follow_up: decision }, 200);
    } catch (error) {
      if (error instanceof SessionAttachmentError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  };
};
