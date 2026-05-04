import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { composeSummary } from "../compose-summary";
import type { SessionsRouteDeps } from "../deps";
import { followUpBodySchema, notFoundResponseSchema, sessionResponseSchema } from "../dto";
import { getSessionMessages } from "../get-session-messages";
import { resolvePrompt } from "../resolve-prompt";
import { resumeAgentSession, spawnAgentSession } from "../spawn-agent";

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
      content: { "application/json": { schema: sessionResponseSchema } },
    },
    404: {
      description: "Session not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    409: {
      description: "Session is currently in progress.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
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

    if (session.status === "in_progress") {
      return c.json(
        { error: "Session is in_progress — wait for it to finish or fail before sending a follow-up." },
        409,
      );
    }

    const prompt = await buildFollowUpPrompt(input, session.project_id!, deps);

    await deps.sessionService.resume(session.id);

    const cwd = session.cwd!;

    const agentId = input.agent ?? session.agent!;
    const switchingAgent = input.agent && input.agent !== session.agent;

    if (switchingAgent) {
      await deps.sessionService.update(session.id, { agent: agentId, agent_session_id: null });

      spawnAgentSession({ sessionId: session.id, agentId, prompt, model: input.model, cwd }, deps);
    } else if (session.agent_session_id) {
      resumeAgentSession(
        {
          sessionId: session.id,
          agentSessionId: session.agent_session_id,
          agentId,
          prompt,
          model: input.model,
          cwd,
          questionResponse: input.question_response,
        },
        deps,
      );
    } else {
      spawnAgentSession({ sessionId: session.id, agentId, prompt, model: input.model, cwd }, deps);
    }

    const result = await deps.sessionService.get(session.id);
    return c.json(result, 200);
  };
};
