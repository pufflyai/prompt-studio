import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { skillResponseSchema } from "../dto";

export const listSkillsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/skills",
  description: "List all skills for a project.",
  tags: ["Skills"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "List of skills.",
      content: { "application/json": { schema: z.array(skillResponseSchema) } },
    },
  },
});

export const listSkillsHandler = (deps: RouteDeps): AppRouteHandler<typeof listSkillsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const skills = await deps.skillService.list(projectId);
    return c.json(
      skills.map((skill) => ({
        id: skill.id,
        project_id: skill.project_id,
        name: skill.name,
        description: skill.description,
        files: skill.files,
        created_at: skill.created_at,
        updated_at: skill.updated_at,
        deleted_at: skill.deleted_at,
      })),
      200,
    );
  };
};
