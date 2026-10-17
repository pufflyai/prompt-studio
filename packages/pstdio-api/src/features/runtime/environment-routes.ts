import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { environmentIdentitySchema, environmentTargetSchema, workspaceSchema } from "pstdio-api-contracts";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";

export const createEnvironmentRoutes = (deps: Pick<RouteDeps, "environmentService" | "workspaceService">) => {
  const routes = new OpenAPIHono<AppBindings>();
  const error = { content: { "application/json": { schema: z.object({ error: z.string() }) } } };
  routes.openapi(
    createRoute({
      method: "get",
      path: "/environment",
      tags: ["Environment"],
      responses: {
        200: {
          description: "Stable identity of this local runtime owner.",
          content: { "application/json": { schema: environmentIdentitySchema } },
        },
      },
    }),
    async (c) => c.json(await deps.environmentService.get(), 200),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/environment/resolve-target",
      tags: ["Environment"],
      request: { body: { content: { "application/json": { schema: environmentTargetSchema } } } },
      responses: {
        200: {
          description: "The exact workspace owned by this environment and workbench.",
          content: { "application/json": { schema: workspaceSchema } },
        },
        404: { description: "Workspace is not owned by the workbench.", ...error },
        409: { description: "Target belongs to another environment.", ...error },
      },
    }),
    async (c) => {
      const target = c.req.valid("json");
      const owner = await deps.environmentService.get();
      if (target.environmentId !== owner.environmentId)
        return c.json({ error: "Target belongs to another environment." }, 409);
      const workspace = await deps.workspaceService.get(target.workspaceId);
      if (!workspace || workspace.project_id !== target.workbenchId)
        return c.json({ error: "Workspace not found in this workbench." }, 404);
      return c.json(workspace, 200);
    },
  );
  return routes;
};
