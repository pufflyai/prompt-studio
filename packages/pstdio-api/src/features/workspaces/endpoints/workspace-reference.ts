import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { notFoundResponseSchema, workspaceResponseSchema } from "../dto";
import { cancelProviderBackedWorkspace } from "../workspace-provider-lifecycle";

const responses = {
  200: { description: "Workspace found.", content: { "application/json": { schema: workspaceResponseSchema } } },
  404: { description: "Workspace not found.", content: { "application/json": { schema: notFoundResponseSchema } } },
};
const request = {
  params: z.object({ id: z.string() }).strict(),
  query: z.object({ project_id: z.string().optional() }).strict(),
};
export const getWorkspaceReferenceRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}",
  tags: ["Workspaces"],
  description: "Get a workspace by UUID or canonical reference.",
  request,
  responses,
});
export const cancelWorkspaceRoute = createRoute({
  method: "post",
  path: "/workspaces/{id}/cancel",
  tags: ["Workspaces"],
  description: "Cancel workspace creation by UUID or canonical reference.",
  request,
  responses,
});
export const getWorkspaceReferenceHandler =
  (deps: WorkspacesRouteDeps): AppRouteHandler<typeof getWorkspaceReferenceRoute> =>
  async (c) => {
    const workspace = await deps.workspaceService.get(c.req.valid("param").id, c.req.valid("query").project_id);
    return workspace ? c.json(workspace, 200) : c.json({ error: "Workspace not found" }, 404);
  };
export const cancelWorkspaceHandler =
  (deps: WorkspacesRouteDeps): AppRouteHandler<typeof cancelWorkspaceRoute> =>
  async (c) => {
    const workspace = await deps.workspaceService.get(c.req.valid("param").id, c.req.valid("query").project_id);
    return workspace
      ? c.json(await cancelProviderBackedWorkspace(deps, workspace), 200)
      : c.json({ error: "Workspace not found" }, 404);
  };
