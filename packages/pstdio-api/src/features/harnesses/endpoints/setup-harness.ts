import { createRoute, z } from "@hono/zod-openapi";
import type { AgentId } from "pstdio-agents";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { harnessConfigResponseSchema, notFoundResponseSchema, setupHarnessBodySchema } from "../dto";
import { toAgentId, toHarnessConfig, toHarnessId } from "../harness-ids";

export const setupHarnessRoute = createRoute({
  method: "post",
  path: "/harnesses",
  description: "Configure a harness provider.",
  tags: ["Harnesses"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: setupHarnessBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Harness configured.",
      content: { "application/json": { schema: harnessConfigResponseSchema } },
    },
    404: {
      description: "Harness not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const setupHarnessHandler = (deps: RouteDeps): AppRouteHandler<typeof setupHarnessRoute> => {
  return async (c) => {
    const { harness_id, binary } = c.req.valid("json");
    const agentId = toAgentId(harness_id);
    if (!deps.agentRegistry.get(agentId as AgentId)) {
      return c.json({ error: `Harness not found: ${toHarnessId(agentId)}` }, 404);
    }

    const createdOrExisting = await deps.agentConfigService.upsert(agentId);
    if (!binary) {
      deps.eventBus.emit("agent_configs", "set", createdOrExisting);
      return c.json(toHarnessConfig(createdOrExisting), 201);
    }

    const result = await deps.agentConfigService.update(agentId, { binary });
    const harness = result?.updated ?? createdOrExisting;
    deps.eventBus.emit("agent_configs", "set", harness);
    return c.json(toHarnessConfig(harness), 201);
  };
};
