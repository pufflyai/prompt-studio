import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

type SessionRecord = Awaited<ReturnType<RouteDeps["sessionService"]["listByAgentSession"]>>[number];

const resolveSessionIdBodySchema = z
  .object({
    agent: z.string().min(1),
    agent_session_id: z.string().min(1),
    cwd: z.string().min(1).optional(),
  })
  .strict();

const resolveSessionIdResponseSchema = z.object({
  session_id: z.string().nullable(),
});

const resolveSessionIdConflictSchema = z.object({
  error: z.string(),
});

const activeStatuses = new Set<SessionRecord["status"]>(["in_progress", "awaiting_input"]);

const resolveSessionIdMatch = (sessions: SessionRecord[], cwd: string | undefined) => {
  if (sessions.length === 0) {
    return { sessionId: null as string | null, error: null as string | null };
  }

  const activeMatches = sessions.filter((session) => activeStatuses.has(session.status));
  const candidates = activeMatches.length > 0 ? activeMatches : sessions;

  if (candidates.length === 1) {
    return { sessionId: candidates[0].id, error: null as string | null };
  }

  if (cwd) {
    const cwdMatches = candidates.filter((session) => session.cwd === cwd);
    if (cwdMatches.length === 1) {
      return { sessionId: cwdMatches[0].id, error: null as string | null };
    }

    if (cwdMatches.length > 1) {
      return { sessionId: null as string | null, error: "Ambiguous session match" };
    }
  }

  return { sessionId: null as string | null, error: "Ambiguous session match" };
};

export const resolveSessionIdRoute = createRoute({
  method: "post",
  path: "/sessions/resolve-session-id",
  description: "Resolve a pstdio session ID from external agent session identity.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: {
        "application/json": {
          schema: resolveSessionIdBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Session ID resolved or not found.",
      content: { "application/json": { schema: resolveSessionIdResponseSchema } },
    },
    409: {
      description: "Multiple sessions match and cannot be disambiguated.",
      content: { "application/json": { schema: resolveSessionIdConflictSchema } },
    },
  },
});

export const resolveSessionIdHandler = (deps: RouteDeps): AppRouteHandler<typeof resolveSessionIdRoute> => {
  return async (c) => {
    const input = c.req.valid("json");

    const matches = await deps.sessionService.listByAgentSession(input.agent, input.agent_session_id);
    const resolved = resolveSessionIdMatch(matches, input.cwd);

    if (resolved.error) {
      return c.json({ error: resolved.error }, 409);
    }

    return c.json({ session_id: resolved.sessionId }, 200);
  };
};
