import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { ensureProjectRepoScaffolding } from "../../projects/bootstrap-project-repo";
import { notFoundResponseSchema } from "../../projects/dto";
import { pluginsParamsSchema, pluginsResponseSchema } from "../dto";
import { getRegisteredPlugins } from "../get-registered-plugins";

export const registerPluginsRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/plugins/register",
  description: "Force registration of plugins for a project.",
  tags: ["Plugins"],
  request: {
    params: pluginsParamsSchema,
  },
  responses: {
    200: {
      description: "Registered plugins.",
      content: { "application/json": { schema: pluginsResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const registerPluginsHandler = (deps: RouteDeps): AppRouteHandler<typeof registerPluginsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const project = await deps.projectService.get(projectId);

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const repos = await deps.repoService.listByProject(projectId);
    await Promise.all(repos.map((repo) => ensureProjectRepoScaffolding(repo.path, deps.filesRoot)));
    deps.pluginService.invalidate(projectId);

    return c.json(await getRegisteredPlugins(deps, projectId), 200);
  };
};
