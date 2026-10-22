import { createRoute, z } from "@hono/zod-openapi";
import { pageQuerySchema } from "pstdio-api-contracts";
import { queryReadableWorkspaces } from "../../../services/personal-history/queries";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { workspaceListItemResponseSchema } from "../dto";
import { toExtensionWorkspace } from "../extension-workspace";

export const queryWorkspacesRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/workspaces",
  tags: ["Workspaces"],
  description: "Query active project workspaces by immutable ID.",
  request: { params: z.object({ projectId: z.string() }), query: pageQuerySchema.strict() },
  responses: {
    200: {
      description: "One workspace page",
      content: {
        "application/json": {
          schema: z.object({ items: z.array(workspaceListItemResponseSchema), nextCursor: z.string().nullable() }),
        },
      },
    },
  },
});
export const queryWorkspacesHandler = (deps: WorkspacesRouteDeps) => {
  const handler: AppRouteHandler<typeof queryWorkspacesRoute> = async (c) => {
    const { projectId } = c.req.valid("param");
    const page = await queryReadableWorkspaces(deps, projectId, c.req.valid("query"));
    return c.json(
      { items: page.rows.map((row) => ({ ...row, ...toExtensionWorkspace(row) })), nextCursor: page.nextCursor },
      200,
    );
  };
  return handler;
};
