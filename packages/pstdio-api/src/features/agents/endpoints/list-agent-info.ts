import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { resolveHarnessName, toAvailabilityInfo } from "../../harnesses/harness-registry-service";
import type { AgentsRouteDeps } from "../deps";
import { agentInfoListResponseSchema } from "../dto";

export const listAgentInfoRoute = createRoute({
  method: "get",
  path: "/agents/info",
  description: "List all known agents with availability status.",
  tags: ["Agents"],

  request: {
    query: z
      .object({
        project: z.string().min(1).optional().openapi({ description: "Only harnesses enabled for this project" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "List of known agents with availability.",
      content: { "application/json": { schema: agentInfoListResponseSchema } },
    },
  },
});

export const listAgentInfoHandler = (deps: AgentsRouteDeps): AppRouteHandler<typeof listAgentInfoRoute> => {
  return async (c) => {
    const { project } = c.req.valid("query");
    const harnesses = await deps.harnessRegistry.list({ projectId: project });
    const result = await Promise.all(
      harnesses.map(async (harness) => ({
        id: harness.id,
        name: resolveHarnessName(harness),
        availability: toAvailabilityInfo(await harness.detect()),
        ...(harness.skills ? { skills: { dir: harness.skills.dir, global_dir: harness.skills.globalDir } } : {}),
      })),
    );
    return c.json(result, 200);
  };
};
