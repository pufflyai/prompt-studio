import { createRoute, z } from "@hono/zod-openapi";
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
    const { name, agents } = c.req.valid("json");
    const project = await deps.projectService.create({ name, selectedAgents: agents });

    try {
      const templates = await seedDefaultTemplates(deps, project.id);
      await seedDefaultSkills(deps, project.id);
      await deps.extensionSetupService.runFirstPartyInitialSetup(project.id);

      deps.eventBus.emit("projects", "set", project);
      for (const template of templates) deps.eventBus.emit("templates", "set", template);

      return c.json(project, 201);
    } catch (error) {
      await deps.projectService.hardDelete(project.id);
      throw error;
    }
  };
};
