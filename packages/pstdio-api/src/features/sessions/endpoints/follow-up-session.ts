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

type FollowUpInput = z.infer<typeof followUpBodySchema>;
type ExistingSession = NonNullable<Awaited<ReturnType<SessionsRouteDeps["sessionService"]["get"]>>>;

const updateLastSelectedModelWhenRequested = async (
  session: ExistingSession,
  inputModel: string | undefined,
  deps: SessionsRouteDeps,
) => {
  if (!inputModel || inputModel === session.last_selected_model) return;

  await deps.sessionService.update(session.id, { last_selected_model: inputModel });
};

const startFollowUpAgentSession = async (input: {
  session: ExistingSession;
  request: FollowUpInput;
  prompt: string;
  cwd: string;
  deps: SessionsRouteDeps;
}) => {
  const { session, request, prompt, cwd, deps } = input;
  const agentId = request.agent ?? session.agent!;
  const switchingAgent = request.agent != null && request.agent !== session.agent;
  const inputModel = request.model?.trim() || undefined;
  const model = inputModel ?? (switchingAgent ? undefined : (session.last_selected_model ?? undefined));

  if (switchingAgent) {
    await deps.sessionService.update(session.id, {
      agent: agentId,
      agent_session_id: null,
      last_selected_model: inputModel ?? null,
    });
    spawnAgentSession({ sessionId: session.id, agentId, prompt, model, cwd }, deps);
    return;
  }

  await updateLastSelectedModelWhenRequested(session, inputModel, deps);

  if (session.agent_session_id) {
    resumeAgentSession(
      {
        sessionId: session.id,
        agentSessionId: session.agent_session_id,
        agentId,
        prompt,
        model,
        cwd,
        questionResponse: request.question_response,
      },
      deps,
    );
    return;
  }

  spawnAgentSession({ sessionId: session.id, agentId, prompt, model, cwd }, deps);
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

    await startFollowUpAgentSession({ session, request: input, prompt, cwd, deps });

    const result = await deps.sessionService.get(session.id);
    return c.json(result, 200);
  };
};
