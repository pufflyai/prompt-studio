import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { badRequestResponseSchema, notFoundResponseSchema, skillResponseSchema, updateSkillBodySchema } from "../dto";

export const editSkillRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/skills/{name}",
  description: "Edit a project-owned skill variation.",
  tags: ["Skills"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z.string().openapi({ description: "Skill name" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: updateSkillBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Skill edited.",
      content: { "application/json": { schema: skillResponseSchema } },
    },
    400: {
      description: "Skill cannot be edited.",
      content: { "application/json": { schema: badRequestResponseSchema } },
    },
    404: {
      description: "Skill not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const editSkillHandler = (deps: RouteDeps): AppRouteHandler<typeof editSkillRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await deps.skillRegistryService.update(projectId, name, body);

    if ("error" in result) {
      if (result.error === "read_only") {
        return c.json({ error: "Extension skills are read-only. Copy the skill before editing it." }, 400);
      }

      return c.json({ error: `Skill not found: ${name}` }, 404);
    }

    return c.json(result.skill, 200);
  };
};
