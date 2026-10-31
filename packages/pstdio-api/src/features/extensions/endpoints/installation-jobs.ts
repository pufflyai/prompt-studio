import { createRoute, z } from "@hono/zod-openapi";
import { extensionInstallationSchema, extensionInstallationsSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

type InstallationDeps = Pick<RouteDeps, "extensionInstallations">;

export const installationJobsRoute = createRoute({
  method: "get",
  path: "/extension-installations",
  tags: ["Extensions"],
  responses: {
    200: {
      description: "Installation jobs on this host.",
      content: { "application/json": { schema: extensionInstallationsSchema } },
    },
  },
});
export const installationJobsHandler =
  (deps: InstallationDeps): AppRouteHandler<typeof installationJobsRoute> =>
  async (c) =>
    c.json(deps.extensionInstallations.list(), 200);

export const retryInstallationJobRoute = createRoute({
  method: "post",
  path: "/extension-installations/{id}/retry",
  tags: ["Extensions"],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    202: {
      description: "The failed operation was queued again.",
      content: { "application/json": { schema: extensionInstallationSchema } },
    },
    404: {
      description: "Installation not found.",
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
    },
  },
});
export const retryInstallationJobHandler =
  (deps: InstallationDeps): AppRouteHandler<typeof retryInstallationJobRoute> =>
  async (c) => {
    const job = deps.extensionInstallations.retry(c.req.valid("param").id);
    return job ? c.json(job, 202) : c.json({ error: "Extension installation not found." }, 404);
  };
