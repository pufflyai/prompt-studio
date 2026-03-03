import { rmSync } from "node:fs";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { findAgent } from "pstdio-agents";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

export const removeAgentRoute = createRoute({
  method: "delete",
  path: "/agents/{agentId}",
  description: "Remove a configured agent.",
  tags: ["Agents"],
  request: {
    params: z.object({
      agentId: z.string().openapi({ description: "Agent identifier" }),
    }),
    query: z.object({
      delete_skills: z
        .string()
        .optional()
        .openapi({ description: "Also delete the agent's skills directory" }),
    }),
  },
  responses: {
    204: {
      description: "Agent removed.",
    },
    404: {
      description: "Agent not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const removeAgentHandler = (deps: RouteDeps): AppRouteHandler<typeof removeAgentRoute> => {
  return async (c) => {
    const { agentId } = c.req.valid("param");
    const { delete_skills } = c.req.valid("query");
    const config = await deps.agentConfigsService.get(agentId);
    const removed = await deps.agentConfigsService.remove(agentId);
    if (!removed || !config) {
      return c.json({ error: "Agent not found" }, 404);
    }

    if (delete_skills === "true") {
      const agent = findAgent(agentId);
      if (agent) {
        const allRepos = await deps.reposService.listAll();
        for (const repo of allRepos) {
          const skillsDir = join(repo.path, agent.skillsDir);
          rmSync(skillsDir, { recursive: true, force: true });
        }
      }
    }

    deps.eventBus.emit("agent_configs", "delete", { id: config.id });
    return c.body(null, 204);
  };
};
