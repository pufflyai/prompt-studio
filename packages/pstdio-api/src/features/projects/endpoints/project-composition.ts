import { createRoute, z } from "@hono/zod-openapi";
import { projectCompositionSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ProjectsRouteDeps } from "../deps";
import { announceProjectCompositionChange, readProjectComposition } from "../project-composition";

const params = z.object({ projectId: z.string() }).strict();
const responses = {
  200: {
    description: "Project workbench configuration.",
    content: { "application/json": { schema: projectCompositionSchema } },
  },
  404: {
    description: "Project not found.",
    content: { "application/json": { schema: z.object({ error: z.string() }) } },
  },
};
export const getProjectCompositionRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/composition",
  tags: ["Projects"],
  request: { params },
  responses,
});
export const putProjectCompositionRoute = createRoute({
  method: "put",
  path: getProjectCompositionRoute.path,
  tags: ["Projects"],
  request: { params, body: { content: { "application/json": { schema: projectCompositionSchema } } } },
  responses,
});
export const getProjectCompositionHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof getProjectCompositionRoute> =>
  async (c) => {
    const { projectId } = c.req.valid("param");
    if (!(await deps.projectService.get(projectId))) return c.json({ error: "Project not found" }, 404);
    return c.json(await readProjectComposition(deps, projectId), 200);
  };
export const putProjectCompositionHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof putProjectCompositionRoute> =>
  async (c) => {
    const { projectId } = c.req.valid("param");
    if (!(await deps.projectService.get(projectId))) return c.json({ error: "Project not found" }, 404);
    const composition = c.req.valid("json");
    await deps.projectInfoService.write(projectId, { composition: JSON.stringify(composition) });
    announceProjectCompositionChange(deps, projectId);
    return c.json(composition, 200);
  };
