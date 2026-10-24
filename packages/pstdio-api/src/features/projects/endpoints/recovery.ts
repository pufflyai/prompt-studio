import { createRoute, z } from "@hono/zod-openapi";
import { projectRecoveryPointSchema, restoreProjectResultSchema, restoreProjectSchema } from "pstdio-api-contracts";
import { RecoveryPointError } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import { createRecordAssets } from "../../extensions/command-environment/record-assets";
import type { ProjectsRouteDeps } from "../deps";

const json = <T extends z.ZodType>(schema: T) => ({ content: { "application/json": { schema } } });
const params = z.object({ id: z.string().min(1) }).strict();
const error = json(z.object({ error: z.string() }));

export const listRecoveryPointsRoute = createRoute({
  method: "get",
  path: "/projects/{id}/recovery-points",
  tags: ["Projects"],
  description: "List this device's recovery points for a cloud project, with their actual capture times.",
  request: { params, query: z.object({}).strict() },
  responses: {
    200: { description: "Available recovery points.", ...json(z.array(projectRecoveryPointSchema)) },
    404: { description: "Project not found.", ...error },
  },
});
export const listRecoveryPointsHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof listRecoveryPointsRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    if (!(await deps.projectService.get(id))) return c.json({ error: "Project not found" }, 404);
    return c.json(await deps.extensionStorageService.recovery.list(id), 200);
  };

export const restoreProjectRoute = createRoute({
  method: "post",
  path: "/projects/{id}/restore",
  tags: ["Projects"],
  description:
    "Restore the project, or one extension's data, to a recovery point. The difference is saved as normal record edits, so it syncs to every device.",
  request: { params, query: z.object({}).strict(), body: { required: true, ...json(restoreProjectSchema) } },
  responses: {
    200: { description: "Restore saved on this device.", ...json(restoreProjectResultSchema) },
    404: { description: "Project not found.", ...error },
    409: {
      description:
        "The recovery point changed, the extension has no data, a saved file is missing, or the disk is full.",
      ...error,
    },
  },
});
export const restoreProjectHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof restoreProjectRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    if (!(await deps.projectService.get(id))) return c.json({ error: "Project not found" }, 404);
    try {
      const result = await deps.extensionStorageService.recovery.restore(id, c.req.valid("json"), (owner) =>
        createRecordAssets(deps.assetTransferService, owner),
      );
      // Open extension views reload their data, as after any storage change.
      deps.eventBus.emit("extension_events", "set", {
        id: crypto.randomUUID(),
        projectId: id,
        eventId: "pstdio.event.storage-changed",
      });
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof RecoveryPointError) return c.json({ error: error.message }, 409);
      throw error;
    }
  };
