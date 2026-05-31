import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { installDefaultExtensions, syncInstalledExtensionsForProject } from "../../extensions/default-extensions";
import type { ProjectsRouteDeps } from "../deps";
import { createProjectBodySchema, projectResponseSchema, toProjectResponse } from "../dto";

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

const enableSyncedProjectExtensions = async (deps: ProjectsRouteDeps, projectId: string) => {
  const extensions = await deps.extensionService.listProjectExtensionInstances(projectId);
  for (const { instance } of extensions) {
    if (!instance.enabled) await deps.extensionService.setProjectExtensionEnabled(instance.id, true);
  }
};

export const createProjectHandler = (deps: ProjectsRouteDeps): AppRouteHandler<typeof createProjectRoute> => {
  return async (c) => {
    const { name, agents } = c.req.valid("json");
    const existingProjects = await deps.projectService.list();
    const project = await deps.projectService.create({ name, selectedAgents: agents });

    try {
      if (existingProjects.length === 0) await installDefaultExtensions();
      await syncInstalledExtensionsForProject({
        extensionService: deps.extensionService,
        projectId: project.id,
      });
      await enableSyncedProjectExtensions(deps, project.id);

      deps.eventBus.emit("projects", "set", project);

      const statuses = await deps.statusService.list(project.id);
      for (const status of statuses) deps.eventBus.emit("ticket_statuses", "set", status);

      const tags = await deps.tagService.list(project.id);
      for (const tag of tags) {
        deps.eventBus.emit("ticket_tags", "set", tag);
        const options = await deps.tagService.listOptions(tag.id);
        for (const option of options) deps.eventBus.emit("ticket_tag_options", "set", option);
      }

      return c.json(toProjectResponse(project), 201);
    } catch (error) {
      await deps.projectService.hardDelete(project.id);
      throw error;
    }
  };
};
