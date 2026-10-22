import { createRoute, z } from "@hono/zod-openapi";
import { projectSnapshotSchema, restoreProjectSchema } from "pstdio-api-contracts";
import { SnapshotSelectionError } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { ProjectsRouteDeps } from "../deps";

const json = <T extends z.ZodType>(schema: T) => ({ content: { "application/json": { schema } } });
const params = z.object({ id: z.string().min(1) }).strict();
const error = json(z.object({ error: z.string() }));
export const listSnapshotsRoute = createRoute({
  method: "get",
  path: "/projects/{id}/snapshots",
  tags: ["Projects"],
  description: "List this device's recovery points for a cloud project, with their actual capture times.",
  request: { params, query: z.object({}).strict() },
  responses: {
    200: { description: "Available recovery points.", ...json(z.array(projectSnapshotSchema)) },
    404: { description: "Project not found.", ...error },
  },
});
export const listSnapshotsHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof listSnapshotsRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    if (!(await deps.projectService.get(id))) return c.json({ error: "Project not found" }, 404);
    const snapshots = await deps.extensionStorageService.snapshots.list(id);
    return c.json(snapshots, 200);
  };

export const restoreProjectRoute = createRoute({
  method: "post",
  path: "/projects/{id}/restore",
  tags: ["Projects"],
  description:
    "Restore project or extension content through normal CRDT edits. Authentication and local folders are unchanged.",
  request: { params, query: z.object({}).strict(), body: { required: true, ...json(restoreProjectSchema) } },
  responses: {
    200: {
      description: "Restore saved locally; normal sync distributes the edits.",
      ...json(z.object({ restored: z.number() })),
    },
    404: { description: "Project not found.", ...error },
    409: { description: "Recovery point changed or is unavailable.", ...error },
  },
});
export const restoreProjectHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof restoreProjectRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    if (!(await deps.projectService.get(id))) return c.json({ error: "Project not found" }, 404);
    try {
      const restored = await deps.extensionStorageService.snapshots.restore(id, c.req.valid("json"));
      deps.eventBus.emit("extension_events", "set", {
        id: crypto.randomUUID(),
        projectId: id,
        eventId: "pstdio.event.storage-changed",
      });
      return c.json(restored, 200);
    } catch (error) {
      if (error instanceof SnapshotSelectionError) return c.json({ error: error.message }, 409);
      throw error;
    }
  };
