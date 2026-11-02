import { createRoute } from "@hono/zod-openapi";
import { updateWorkspaceCapacityInputSchema, workspaceCapacitySchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";

const responses = {
  200: {
    description: "Capacity on the device serving this request, across all projects.",
    content: { "application/json": { schema: workspaceCapacitySchema } },
  },
};
export const getWorkspaceCapacityRoute = createRoute({
  method: "get",
  path: "/workspaces/capacity",
  tags: ["Workspaces"],
  responses,
});
export const updateWorkspaceCapacityRoute = createRoute({
  method: "patch",
  path: "/workspaces/capacity",
  tags: ["Workspaces"],
  request: {
    body: { required: true, content: { "application/json": { schema: updateWorkspaceCapacityInputSchema } } },
  },
  responses,
});
export const getWorkspaceCapacityHandler =
  (deps: WorkspacesRouteDeps): AppRouteHandler<typeof getWorkspaceCapacityRoute> =>
  async (c) =>
    c.json(await deps.workspaceCapacityService.get(), 200);
export const updateWorkspaceCapacityHandler =
  (deps: WorkspacesRouteDeps): AppRouteHandler<typeof updateWorkspaceCapacityRoute> =>
  async (c) =>
    c.json(await deps.workspaceCapacityService.update(c.req.valid("json")), 200);
