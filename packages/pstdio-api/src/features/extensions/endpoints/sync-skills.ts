import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { syncExtensionSkillsForAllProjects } from "../../skills/sync-extension-skills";

const syncSkillsResponseSchema = z.object({
  installs: z.number().int().nonnegative(),
  skills: z.number().int().nonnegative(),
});

export const syncExtensionSkillsRoute = createRoute({
  method: "post",
  path: "/extensions/sync-skills",
  description:
    "Install every enabled extension's skills into all projects' active agents. Idempotent; overwrites existing skill files.",
  tags: ["Extensions"],
  request: {
    body: {
      content: { "application/json": { schema: z.object({}).strict() } },
      required: false,
    },
  },
  responses: {
    200: {
      description: "Sync completed.",
      content: { "application/json": { schema: syncSkillsResponseSchema } },
    },
  },
});

export const syncExtensionSkillsHandler =
  (deps: RouteDeps): AppRouteHandler<typeof syncExtensionSkillsRoute> =>
  async (c) => {
    const result = await syncExtensionSkillsForAllProjects(deps);
    return c.json(result, 200);
  };
