import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { commandExecuteBodySchema } from "pstdio-api-contracts";
import { sessionLogger } from "../../../lib/logger";
import type { AppBindings, AppRouteHandler } from "../../../types";
import { prepareCommandSubscription } from "../../extensions/command-stream-subscription";
import type { ExtensionsRouteDeps } from "../../extensions/deps";
import type { SessionsRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import type { SessionStreamConnections } from "../session-stream-connections";
import { streamSession } from "./stream-session";

// Bun closes connections that stay quiet for 20 seconds.
const HEARTBEAT_MS = 8_000;

export const openSessionStreamHandler = (connections: SessionStreamConnections) => (c: Context<AppBindings>) =>
  streamSSE(c, async (stream) => {
    const connectionId = connections.open(stream);
    await stream.writeSSE({ event: "connected", data: JSON.stringify({ connection_id: connectionId }) });
    while (!stream.aborted) {
      await stream.sleep(HEARTBEAT_MS);
      await stream.writeSSE({ event: "heartbeat", data: JSON.stringify({ timestamp: Date.now() }) });
    }
  });

const connectionParamsSchema = z
  .object({ connectionId: z.string().openapi({ description: "Session stream connection ID" }) })
  .strict();

export const subscribeSessionStreamRoute = createRoute({
  method: "post",
  path: "/session-stream/{connectionId}/subscriptions",
  description: "Stream a session's events on an open session stream.",
  tags: ["Sessions"],
  request: {
    params: connectionParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: z.union([
            z.object({ subscription_id: z.string().min(1), session_id: z.string().min(1) }).strict(),
            z
              .object({
                subscription_id: z.string().min(1),
                command: z
                  .object({
                    project_id: z.string().min(1),
                    command_id: z.string().min(1),
                    body: commandExecuteBodySchema,
                  })
                  .strict(),
              })
              .strict(),
          ]),
        },
      },
    },
  },
  responses: {
    204: { description: "Subscription started." },
    409: {
      description: "Command is not streamable.",
      content: { "application/json": { schema: z.object({ error: z.string(), code: z.string() }) } },
    },
    404: {
      description: "Session stream not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const subscribeSessionStreamHandler = (
  deps: SessionsRouteDeps & ExtensionsRouteDeps,
  connections: SessionStreamConnections,
): AppRouteHandler<typeof subscribeSessionStreamRoute> => {
  return async (c) => {
    const { connectionId } = c.req.valid("param");
    const input = c.req.valid("json");
    if ("command" in input) {
      const prepared = await prepareCommandSubscription(deps, input.command);
      if ("error" in prepared) return c.json({ error: prepared.error, code: prepared.code }, prepared.status);
      const started = connections.subscribe(connectionId, input.subscription_id, prepared.run);
      if (!started) return c.json({ error: `Session stream not found: ${connectionId}` }, 404);
      return c.body(null, 204);
    }
    const { subscription_id, session_id } = input;
    const started = connections.subscribe(connectionId, subscription_id, (sink) =>
      streamSession(session_id, deps, sink).catch(async (err) => {
        sessionLogger.error({ err, event: "session.stream.failed", session_id }, "Session stream failed");
        await sink.write("error", { message: err instanceof Error ? err.message : String(err) });
      }),
    );
    if (!started) return c.json({ error: `Session stream not found: ${connectionId}` }, 404);
    return c.body(null, 204);
  };
};

export const unsubscribeSessionStreamRoute = createRoute({
  method: "delete",
  path: "/session-stream/{connectionId}/subscriptions/{subscriptionId}",
  description: "Stop streaming a session on an open session stream.",
  tags: ["Sessions"],
  request: {
    params: connectionParamsSchema.extend({ subscriptionId: z.string().openapi({ description: "Subscription ID" }) }),
  },
  responses: {
    204: { description: "Subscription stopped." },
  },
});

export const unsubscribeSessionStreamHandler = (
  connections: SessionStreamConnections,
): AppRouteHandler<typeof unsubscribeSessionStreamRoute> => {
  return async (c) => {
    const { connectionId, subscriptionId } = c.req.valid("param");
    connections.unsubscribe(connectionId, subscriptionId);
    return c.body(null, 204);
  };
};
