import { createRoute, z } from "@hono/zod-openapi";
import { initialWorkspaceSchema, workspaceSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ProjectsRouteDeps } from "../deps";
import { initializeProjectWorkspace, resolveInitialWorkspace, withFolderCreation } from "../project-folder";

export const attachWorkspaceRoute = createRoute({
  method: "post",
  path: "/projects/{id}/initial-workspace",
  tags: ["Projects"],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: initialWorkspaceSchema } } },
  },
  responses: {
    201: { description: "Initial workspace attached.", content: { "application/json": { schema: workspaceSchema } } },
    400: {
      description: "Invalid folder.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    409: {
      description: "Project or folder already has a workspace.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});
export const attachWorkspaceHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof attachWorkspaceRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    if (!(await deps.projectService.get(id))) return c.json({ error: "Project not found." }, 404);
    let initial: Awaited<ReturnType<typeof resolveInitialWorkspace>>;
    try {
      initial = await resolveInitialWorkspace({ initial_workspace: c.req.valid("json") });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
    return withFolderCreation(initial.path ?? id, async () => {
      const home = await deps.workspaceService.getDefault(id);
      if (
        home?.root_path ||
        home?.provider_ref_json ||
        home?.provider_operation_id ||
        (initial.path && (await deps.workspaceService.findDefaultByPath(initial.path)))
      )
        return c.json({ error: "An initial workspace is already attached to this project or folder." }, 409);
      return c.json(await initializeProjectWorkspace(deps, id, initial.initial), 201);
    });
  };
