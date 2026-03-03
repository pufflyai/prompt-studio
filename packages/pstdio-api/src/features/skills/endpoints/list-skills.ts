import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { listSkillsQuerySchema, skillListResponseSchema } from "../dto";

export const listSkillsRoute = createRoute({
  method: "get",
  path: "/skills",
  description: "List installed skills for an agent (project-scoped or global).",
  tags: ["Skills"],
  request: {
    query: listSkillsQuerySchema,
  },
  responses: {
    200: {
      description: "List of installed skills.",
      content: { "application/json": { schema: skillListResponseSchema } },
    },
    400: {
      description: "Missing required parameter.",
    },
  },
});

export const listSkillsHandler = (deps: RouteDeps): AppRouteHandler<typeof listSkillsRoute> => {
  return async (c) => {
    const { agent_id, scope, project_id } = c.req.valid("query");

    if (scope === "project") {
      if (!project_id) {
        return c.json({ error: "project_id is required when scope=project" }, 400);
      }
      const skills = await deps.skillsService.listProjectSkills(project_id, agent_id);
      return c.json(skills, 200);
    }

    const skills = await deps.skillsService.listGlobalSkills(agent_id);
    return c.json(skills, 200);
  };
};
