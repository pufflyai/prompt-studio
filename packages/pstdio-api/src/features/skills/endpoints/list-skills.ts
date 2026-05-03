import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { skillResponseSchema } from "../dto";
import { listSkillRegistry } from "../registry/list-registry";

export const listSkillsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/skills",
  description: "List all skills available to a project: enabled extension-provided defaults plus project-owned skills.",
  tags: ["Skills"],
  request: {
    query: z
      .object({
        sourceKind: z.enum(["project", "extension-default"]).optional(),
        includeDisabled: z.enum(["true", "false"]).optional(),
      })
      .strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "List of skills (merged registry).",
      content: { "application/json": { schema: z.array(skillResponseSchema) } },
    },
  },
});

export const listSkillsHandler = (deps: RouteDeps): AppRouteHandler<typeof listSkillsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const { sourceKind, includeDisabled } = c.req.valid("query");
    const skills = await listSkillRegistry(deps, projectId, {
      includeDisabledExtensionDefaults: includeDisabled === "true",
    });
    const filtered = sourceKind ? skills.filter((skill) => skill.source_kind === sourceKind) : skills;
    return c.json(filtered, 200);
  };
};
