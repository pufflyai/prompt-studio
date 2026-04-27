import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";
import { toAgentId, toHarnessId } from "../harness-ids";

export const removeHarnessRoute = createRoute({
  method: "delete",
  path: "/harnesses/{harnessId}",
  description: "Remove harness configuration.",
  tags: ["Harnesses"],
  request: {
    params: z.object({ harnessId: z.string() }).strict(),
  },
  responses: {
    204: {
      description: "Harness removed.",
    },
    404: {
      description: "Harness not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const removeHarnessHandler = (deps: RouteDeps): AppRouteHandler<typeof removeHarnessRoute> => {
  return async (c) => {
    const { harnessId } = c.req.valid("param");
    const agentId = toAgentId(harnessId);
    const config = await deps.agentConfigService.get(agentId);
    const removed = await deps.agentConfigService.remove(agentId);
    if (!config || !removed) {
      return c.json({ error: `Harness not found: ${toHarnessId(agentId)}` }, 404);
    }

    deps.eventBus.emit("agent_configs", "delete", config);
    return c.body(null, 204);
  };
};
