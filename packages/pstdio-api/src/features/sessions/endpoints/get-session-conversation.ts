import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { SessionMessage } from "pstdio-api-contracts";
import type { AppBindings } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { notFoundResponseSchema, sessionConversationResponseSchema } from "../dto";
import { getSessionMessages } from "../get-session-messages";
import { resolveSessionAttachments, sessionAttachmentFileParts } from "../session-attachments";

const appendQueuedPrompts = async (
  deps: SessionsRouteDeps,
  input: { projectId: string; sessionId: string; messages: SessionMessage[] },
) => {
  const queuedEntries = await deps.sessionQueueEntriesService.listPendingBySession(input.sessionId);

  if (queuedEntries.length === 0) return input.messages;

  const queuedMessages: SessionMessage[] = [];
  for (const entry of queuedEntries) {
    const attachments = await resolveSessionAttachments(deps, input.projectId, entry.attachments_json ?? []);

    queuedMessages.push({
      id: `queued-prompt-${input.sessionId}-${entry.queue_position}`,
      role: "user",
      parts: [{ type: "text", text: entry.prompt }, ...sessionAttachmentFileParts(attachments)],
    });
  }

  return [...input.messages, ...queuedMessages];
};

// A queued attachment can be deleted out from under us; fall back to the stored
// messages rather than failing the whole conversation request with a 500.
const hydrateQueuedPrompts = async (
  deps: SessionsRouteDeps,
  input: { projectId: string; sessionId: string; messages: SessionMessage[] },
) => {
  try {
    return await appendQueuedPrompts(deps, input);
  } catch {
    return input.messages;
  }
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

export const getSessionConversationHandler = (deps: SessionsRouteDeps) => {
  return async (c: Context<AppBindings>) => {
    const id = c.req.param("id")!;
    const session = await deps.sessionService.get(id);

    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    const messages = await getSessionMessages(id, deps);
    const hydratedMessages = session.project_id
      ? await hydrateQueuedPrompts(deps, { projectId: session.project_id, sessionId: id, messages })
      : messages;
    return c.json({ session, messages: hydratedMessages }, 200);
  };
};
