import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { workspaceResponseSchema } from "../../workspaces/dto";
import { toExtensionWorkspace } from "../../workspaces/extension-workspace";
import type { ProjectsRouteDeps } from "../deps";
import { openProject } from "../open-project";

const error = { content: { "application/json": { schema: z.object({ error: z.string() }) } } };
export const openProjectRoute = createRoute({
  method: "post",
  path: "/projects/{id}/open",
  tags: ["Projects"],
  description:
    "Prepare this device's project folder and restore downloaded artifact files without cloning a repository.",
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: {
    200: {
      description: "Project workspace ready.",
      content: { "application/json": { schema: workspaceResponseSchema } },
    },
    400: { description: "Project setup failed. Opening again retries setup.", ...error },
    404: { description: "Project not found.", ...error },
  },
});

export const openProjectHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof openProjectRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    if (!(await deps.projectService.get(id))) return c.json({ error: "Project not found." }, 404);
    try {
      const workspace = await openProject(deps, id);
      return c.json({ ...workspace, ...toExtensionWorkspace(workspace) }, 200);
    } catch (cause) {
      return c.json({ error: cause instanceof Error ? cause.message : String(cause) }, 400);
    }
  };
