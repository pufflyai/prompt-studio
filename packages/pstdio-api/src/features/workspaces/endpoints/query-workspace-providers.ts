import { createRoute, z } from "@hono/zod-openapi";
import {
  pageQuerySchema,
  type WorkspaceProviderDescriptor,
  workspaceProviderDescriptorSchema,
} from "pstdio-api-contracts";
import { catalogPage } from "../../../services/catalog-page";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { listWorkspaceProviders } from "../workspace-provider-catalog";
export const queryWorkspaceProvidersRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/workspace-providers/query",
  tags: ["Workspaces"],
  request: { params: z.object({ projectId: z.string() }), query: pageQuerySchema.strict() },
  responses: {
    200: {
      description: "One provider page",
      content: {
        "application/json": {
          schema: z.object({ items: z.array(workspaceProviderDescriptorSchema), nextCursor: z.string().nullable() }),
        },
      },
    },
  },
});
export const queryWorkspaceProvidersHandler = (deps: WorkspacesRouteDeps) => {
  const handler: AppRouteHandler<typeof queryWorkspaceProvidersRoute> = async (c) => {
    const { projectId } = c.req.valid("param");
    const items = (await listWorkspaceProviders(deps, projectId)) as WorkspaceProviderDescriptor[];
    return c.json(catalogPage(items, `providers:${projectId}`, c.req.valid("query")), 200);
  };
  return handler;
};
