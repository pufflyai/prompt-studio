import { createRoute } from "@hono/zod-openapi";
import { queuedSteeringResultSchema, steerQueuedFollowUpInputSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { steerQueuedFollowUp } from "../queued-steering";
import { queuedFollowUpParamsSchema } from "./queued-follow-ups";

export const steerQueuedFollowUpRoute = createRoute({
  method: "post",
  path: "/sessions/{id}/queued-follow-ups/{queuePosition}/steer",
  tags: ["Sessions"],
  description: "Deliver a saved request to its captured active run without starting another run.",
  request: {
    params: queuedFollowUpParamsSchema,
    body: { content: { "application/json": { schema: steerQueuedFollowUpInputSchema } } },
  },
  responses: {
    200: {
      description: "Accepted, rejected, or uncertain native delivery.",
      content: { "application/json": { schema: queuedSteeringResultSchema } },
    },
  },
});
export const steerQueuedFollowUpHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof steerQueuedFollowUpRoute> =>
  async (c) => {
    const { id, queuePosition } = c.req.valid("param");
    return c.json(await steerQueuedFollowUp(deps, id, queuePosition, c.req.valid("json")), 200);
  };
