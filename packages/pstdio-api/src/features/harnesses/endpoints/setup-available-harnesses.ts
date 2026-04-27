import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { harnessConfigListResponseSchema, setupAvailableHarnessesBodySchema } from "../dto";
import { toAgentId, toHarnessConfig } from "../harness-ids";

export const setupAvailableHarnessesRoute = createRoute({
  method: "post",
  path: "/harnesses/setup-available",
  description: "Set up all available harness providers. Marks the specified harness as the default.",
  tags: ["Harnesses"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: setupAvailableHarnessesBodySchema } },
    },
  },
  responses: {
    201: {
      description: "All available harness providers configured.",
      content: { "application/json": { schema: harnessConfigListResponseSchema } },
    },
  },
});

export const setupAvailableHarnessesHandler = (
  deps: RouteDeps,
): AppRouteHandler<typeof setupAvailableHarnessesRoute> => {
  return async (c) => {
    const { default_harness_id } = c.req.valid("json");
    const defaultAgentId = toAgentId(default_harness_id);
    const installedAgents = deps.agentRegistry.list().filter((agent) => agent.checkAvailability().type === "INSTALLED");

    for (const agent of installedAgents) {
      await deps.agentConfigService.upsert(agent.id);
    }

    if (installedAgents.some((agent) => agent.id === defaultAgentId)) {
      await deps.agentConfigService.update(defaultAgentId, { is_default: true });
    }

    const updated = await deps.agentConfigService.list();
    for (const config of updated) {
      deps.eventBus.emit("agent_configs", "set", config);
    }

    return c.json(updated.map(toHarnessConfig), 201);
  };
};
