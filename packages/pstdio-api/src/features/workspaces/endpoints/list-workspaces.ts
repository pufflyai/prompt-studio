import { createRoute, z } from "@hono/zod-openapi";
import { readableWorkspaces } from "../../../services/personal-history/queries";
import type { AppRouteHandler } from "../../../types";
import { projectQueryFields, projectQueryMessage, validProjectQuery } from "../../project-query";
import type { WorkspacesRouteDeps } from "../deps";
import { workspaceListItemResponseSchema } from "../dto";
import { toExtensionWorkspace } from "../extension-workspace";

const listWorkspacesQuerySchema = z
  .object({
    ...projectQueryFields,
  })
  .strict()
  .refine(validProjectQuery, { message: projectQueryMessage });

export const listWorkspacesRoute = createRoute({
  deprecated: true,
  method: "get",
  path: "/workspaces",
  description: "List active workspaces for a project.",
  tags: ["Workspaces"],
  request: {
    query: listWorkspacesQuerySchema,
  },
  responses: {
    200: {
      description: "List of workspaces.",
      content: { "application/json": { schema: z.array(workspaceListItemResponseSchema) } },
    },
  },
});

export const listWorkspacesHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof listWorkspacesRoute> => {
  return async (c) => {
    const { projectId, project_id } = c.req.valid("query");
    const workspaces = await readableWorkspaces(deps, (projectId ?? project_id)!);
    return c.json(
      workspaces.map((workspace) => ({ ...workspace, ...toExtensionWorkspace(workspace) })),
      200,
    );
  };
};
