import { createRoute, z } from "@hono/zod-openapi";
import { workspaceProviderDescriptorSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { listWorkspaceProviders } from "../workspace-provider-catalog";

export const listWorkspaceProvidersRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/workspace-providers",
  tags: ["Workspaces"],
  request: { params: z.object({ projectId: z.string() }) },
  responses: {
    200: {
      description: "Available workspace providers and their parameters.",
      content: { "application/json": { schema: z.array(workspaceProviderDescriptorSchema) } },
    },
  },
});
export const listWorkspaceProvidersHandler =
  (deps: WorkspacesRouteDeps): AppRouteHandler<typeof listWorkspaceProvidersRoute> =>
  async (c) =>
    c.json(await listWorkspaceProviders(deps, c.req.valid("param").projectId), 200);
