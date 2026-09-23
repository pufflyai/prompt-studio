import { createRoute, z } from "@hono/zod-openapi";
import { initialWorkspaceSchema, workspaceSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ProjectsRouteDeps } from "../deps";
import { retryProjectExtensions } from "../project-extension-setup";
import { initializeProjectWorkspace, withFolderCreation } from "../project-folder";

const errorSchema = z.object({ error: z.string() });

export const retryProjectSetupRoute = createRoute({
  method: "post",
  path: "/projects/{id}/retry-setup",
  tags: ["Projects"],
  description: "Retry project initialization using its existing default workspace.",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Current initial workspace setup result.",
      content: { "application/json": { schema: workspaceSchema } },
    },
    404: { description: "Project not found.", content: { "application/json": { schema: errorSchema } } },
    409: {
      description: "Attach an initial workspace first.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const retryProjectSetupHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof retryProjectSetupRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    if (!(await deps.projectService.get(id))) return c.json({ error: "Project not found." }, 404);
    const home = await deps.workspaceService.getDefault(id);
    if (!home || (!home.root_path && !home.provider_ref_json && !home.provider_operation_id))
      return c.json({ error: "Attach an initial workspace before retrying setup." }, 409);
    return withFolderCreation(home.root_path ?? id, async () => {
      const workspace = await initializeProjectWorkspace(
        deps,
        id,
        initialWorkspaceSchema.parse({ provider_id: home.provider_id, params: home.provider_params_json }),
        () => retryProjectExtensions(deps, id),
      );
      return c.json(workspace, 200);
    });
  };
