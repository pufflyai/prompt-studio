import { createRoute, z } from "@hono/zod-openapi";
import { eq, ticket_statuses, ticket_tags } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { seedDefaultSkills } from "../../skills/seed-default-skills";
import { seedDefaultTemplates } from "../../templates/seed-default-templates";
import { createProjectBodySchema, projectResponseSchema } from "../dto";

export const createProjectRoute = createRoute({
  method: "post",
  path: "/projects",
  description: "Create a new project.",
  tags: ["Projects"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: createProjectBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Project created.",
      content: { "application/json": { schema: projectResponseSchema } },
    },
  },
});

export const createProjectHandler = (deps: RouteDeps): AppRouteHandler<typeof createProjectRoute> => {
  return async (c) => {
    const { name } = c.req.valid("json");
    const project = await deps.projectsService.create({ name });

    try {
      const templates = await seedDefaultTemplates(deps, project.id);
      await seedDefaultSkills(deps, project.id);

      deps.eventBus.emit("projects", "set", project);

      const statuses = await deps.db.select().from(ticket_statuses).where(eq(ticket_statuses.project_id, project.id));
      for (const status of statuses) deps.eventBus.emit("ticket_statuses", "set", status);

      const tags = await deps.db.select().from(ticket_tags).where(eq(ticket_tags.project_id, project.id));
      for (const tag of tags) deps.eventBus.emit("ticket_tags", "set", tag);

      for (const template of templates) deps.eventBus.emit("templates", "set", template);

      return c.json(project, 201);
    } catch (error) {
      await deps.projectsService.hardDelete(project.id);
      throw error;
    }
  };
};
