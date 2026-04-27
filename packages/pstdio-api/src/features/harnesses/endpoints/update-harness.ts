import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { harnessConfigResponseSchema, notFoundResponseSchema, updateHarnessBodySchema } from "../dto";
import { toAgentId, toHarnessConfig, toHarnessId } from "../harness-ids";

export const updateHarnessRoute = createRoute({
  method: "patch",
  path: "/harnesses/{harnessId}",
  description: "Update harness configuration.",
  tags: ["Harnesses"],
  request: {
    params: z.object({ harnessId: z.string() }).strict(),
    body: {
      content: { "application/json": { schema: updateHarnessBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Harness updated.",
      content: { "application/json": { schema: harnessConfigResponseSchema } },
    },
    404: {
      description: "Harness not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const updateHarnessHandler = (deps: RouteDeps): AppRouteHandler<typeof updateHarnessRoute> => {
  return async (c) => {
    const { harnessId } = c.req.valid("param");
    const result = await deps.agentConfigService.update(toAgentId(harnessId), c.req.valid("json"));
    if (!result) {
      return c.json({ error: `Harness not found: ${toHarnessId(toAgentId(harnessId))}` }, 404);
    }

    deps.eventBus.emit("agent_configs", "set", result.updated);
    return c.json(toHarnessConfig(result.updated), 200);
  };
};
