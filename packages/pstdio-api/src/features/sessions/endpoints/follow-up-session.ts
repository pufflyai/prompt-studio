import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { followUpBodySchema, notFoundResponseSchema, sessionResponseSchema } from "../dto";
import { resolveSessionCwd } from "../resolve-session-cwd";
import { fireSessionResumeHook } from "../session-hooks";
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

export const followUpSessionHandler = (deps: RouteDeps): AppRouteHandler<typeof followUpSessionRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const session = await deps.sessionsService.get(id);
    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    if (session.status === "in_progress") {
      return c.json(
        { error: "Session is in_progress — wait for it to finish or fail before sending a follow-up." },
        409,
      );
    }

    const updated = await deps.sessionsService.updateStatus(session.id, "in_progress");
    deps.eventBus.emit("sessions", "set", updated);
    if (session.project_id) {
      fireSessionResumeHook(deps, { id: session.id, project_id: session.project_id, status: "in_progress" });
    }

    const workspace = await deps.workspaceSessionsService.getWorkspaceBySessionId(session.id);
    const cwd = await resolveSessionCwd(deps, session.project_id!, workspace?.id);

    const agentId = input.agent ?? session.agent!;
    const switchingAgent = input.agent && input.agent !== session.agent;

    if (switchingAgent) {
      await deps.sessionsService.update(session.id, { agent: agentId, agent_session_id: null });

      spawnAgentSession({ sessionId: session.id, agentId, prompt: input.prompt, model: input.model, cwd }, deps);
    } else if (session.agent_session_id) {
      resumeAgentSession(
        {
          sessionId: session.id,
          agentSessionId: session.agent_session_id,
          agentId,
          prompt: input.prompt,
          model: input.model,
          cwd,
        },
        deps,
      );
    } else {
      spawnAgentSession({ sessionId: session.id, agentId, prompt: input.prompt, model: input.model, cwd }, deps);
    }

    const result = await deps.sessionsService.get(session.id);
    return c.json(result, 200);
  };
};
