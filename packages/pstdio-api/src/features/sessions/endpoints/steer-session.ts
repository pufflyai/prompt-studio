import { createRoute, z } from "@hono/zod-openapi";
import { queuedSteeringResultSchema, sessionSteeringInputSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { steerSession } from "../session-steering";

export const steerSessionRoute = createRoute({
  method: "post",
  path: "/sessions/{id}/steer",
  tags: ["Sessions"],
  description: "Deliver new input only to the captured active run, without starting or queuing another turn.",
  request: {
    params: z.object({ id: z.string() }).strict(),
    body: { content: { "application/json": { schema: sessionSteeringInputSchema } } },
  },
  responses: {
    200: {
      description: "Accepted, rejected, or uncertain native delivery.",
      content: { "application/json": { schema: queuedSteeringResultSchema } },
    },
  },
});

export const steerSessionHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof steerSessionRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await steerSession(deps, id, c.req.valid("json")), 200);
  };
