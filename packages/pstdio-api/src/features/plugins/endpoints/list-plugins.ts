import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const pluginInfoSchema = z.object({
  identity: z.string(),
  filePath: z.string(),
});

const responseSchema = z.object({
  plugins: z.array(pluginInfoSchema),
  pluginsDir: z.string().nullable(),
});

export const listPluginsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/plugins",
  description: "List registered plugins for a project.",
  tags: ["Plugins"],
  request: {
    params: z.object({ projectId: z.string().openapi({ description: "Project ID" }) }).strict(),
  },
  responses: {
    200: {
      description: "List of registered plugins.",
      content: { "application/json": { schema: responseSchema } },
    },
  },
});

export const listPluginsHandler = (deps: RouteDeps): AppRouteHandler<typeof listPluginsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const runtime = await deps.pluginService.getForProject(projectId);
    const pluginsDir = runtime.repoPath ? `${runtime.repoPath}/.pstdio/plugins` : null;

    return c.json({ plugins: runtime.plugins, pluginsDir }, 200);
  };
};
