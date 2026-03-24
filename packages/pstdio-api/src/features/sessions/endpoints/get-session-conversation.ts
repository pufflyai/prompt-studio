import { readFileSync } from "node:fs";
import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AgentId, SessionMessage } from "pstdio-agents";
import type { AppBindings } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, sessionConversationResponseSchema } from "../dto";
import { resolveSessionCwd } from "../resolve-session-cwd";
import { buildMessagesFromPatches } from "../session-messages";

const getPersistedSessionMessages = async (sessionFileId: string, deps: RouteDeps) => {
  const file = await deps.filesService.get(sessionFileId);
  if (!file) return [];

  return JSON.parse(readFileSync(file.storage_path, "utf-8")) as SessionMessage[];
};

const getAgentMessages = async (
  agentId: string,
  agentSessionId: string,
  projectId: string,
  sessionId: string,
  deps: RouteDeps,
) => {
  const agent = deps.agentRegistry.get(agentId as AgentId);
  if (!agent) return null;

  const workspace = await deps.workspacesService.getBySessionId(sessionId);
  const cwd = await resolveSessionCwd(deps, projectId, workspace?.id);
  return agent.getMessages(agentSessionId, cwd ? { cwd } : undefined);
};

export const getSessionConversationRoute = createRoute({
  method: "get",
  path: "/sessions/{id}/conversation",
  description: "Get a session and its full conversation.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Session ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Session and conversation found.",
      content: { "application/json": { schema: sessionConversationResponseSchema } },
    },
    404: {
      description: "Session not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getSessionConversationHandler = (deps: RouteDeps) => {
  return async (c: Context<AppBindings>) => {
    const id = c.req.param("id")!;
    const session = await deps.sessionsService.get(id);

    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    const persistedMessages = session.session_file_id
      ? await getPersistedSessionMessages(session.session_file_id, deps)
      : [];
    const entry = deps.sessionStore.get(id);

    let messages: SessionMessage[];
    if (entry) {
      messages = buildMessagesFromPatches(entry.eventStore.getHistory(), persistedMessages);
    } else if (session.agent && session.agent_session_id && session.project_id) {
      const agentMessages = await getAgentMessages(
        session.agent,
        session.agent_session_id,
        session.project_id,
        session.id,
        deps,
      ).catch(() => null);
      messages = agentMessages ?? persistedMessages;
    } else {
      messages = persistedMessages;
    }

    return c.json({ session, messages }, 200);
  };
};
