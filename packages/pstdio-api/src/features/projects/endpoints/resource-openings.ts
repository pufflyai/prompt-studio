import { createRoute, z } from "@hono/zod-openapi";
import { resourceOpeningsRequestSchema, resourceOpeningsResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ProjectsRouteDeps } from "../deps";
import { resolveResourceOpenings } from "../resource-openers";

export const resolveResourceOpeningsRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/resource-openings",
  tags: ["Projects"],
  request: {
    params: z.object({ projectId: z.string() }).strict(),
    body: { content: { "application/json": { schema: resourceOpeningsRequestSchema } } },
  },
  responses: {
    200: {
      description: "Configured resource openings.",
      content: { "application/json": { schema: resourceOpeningsResponseSchema } },
    },
    400: {
      description: "A resource belongs to another project.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});
export const resolveResourceOpeningsHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof resolveResourceOpeningsRoute> =>
  async (c) => {
    const { projectId } = c.req.valid("param");
    if (!(await deps.projectService.get(projectId))) return c.json({ error: "Project not found" }, 404);
    const { resources } = c.req.valid("json");
    if (resources.some((resource) => resource.projectId && resource.projectId !== projectId))
      return c.json({ error: "Resource belongs to another project." }, 400);
    const openings = await resolveResourceOpenings(deps, { projectId, signal: c.req.raw.signal }, resources);
    return c.json(resourceOpeningsResponseSchema.parse(openings), 200);
  };
