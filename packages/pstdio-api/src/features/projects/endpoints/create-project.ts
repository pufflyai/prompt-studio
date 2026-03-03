import { createRoute } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { ticket_statuses, ticket_tags } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { createProjectBodySchema, projectResponseSchema } from "../dto";

export const createProjectRoute = createRoute({
  method: "post",
  path: "/projects",
  description: "Create a new project.",
  tags: ["Projects"],
  request: {
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

    deps.eventBus.emit("projects", "set", project);

    const statuses = await deps.db.select().from(ticket_statuses).where(eq(ticket_statuses.project_id, project.id));
    for (const status of statuses) deps.eventBus.emit("ticket_statuses", "set", status);

    const tags = await deps.db.select().from(ticket_tags).where(eq(ticket_tags.project_id, project.id));
    for (const tag of tags) deps.eventBus.emit("ticket_tags", "set", tag);

    return c.json(project, 201);
  };
};
