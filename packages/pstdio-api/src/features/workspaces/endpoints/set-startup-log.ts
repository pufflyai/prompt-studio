import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, uploadStartupLogBodySchema } from "../dto";

export const setStartupLogRoute = createRoute({
  method: "put",
  path: "/workspaces/{id}/startup-log",
  description: "Upload and attach a startup log to a workspace.",
  tags: ["Workspaces"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Workspace ID" }),
    }),
    body: {
      content: { "application/json": { schema: uploadStartupLogBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Startup log saved.",
      content: { "application/json": { schema: z.object({ file_id: z.string() }) } },
    },
    404: {
      description: "Workspace not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const setStartupLogHandler = (deps: RouteDeps): AppRouteHandler<typeof setStartupLogRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { content_base64 } = c.req.valid("json");

    const workspace = await deps.workspacesService.get(id);
    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    const data = Buffer.from(content_base64, "base64");

    if (workspace.startup_log_file_id) {
      const updated = await deps.filesService.update(workspace.startup_log_file_id, { data });
      if (updated) {
        return c.json({ file_id: workspace.startup_log_file_id }, 200);
      }
    }

    const file = await deps.filesService.upload({
      project_id: workspace.project_id,
      file_name: "startup.log",
      file_kind: "startup_log",
      data,
      mime_type: "text/plain",
    });

    await deps.workspacesService.setStartupLogFileId(id, file.id);

    return c.json({ file_id: file.id }, 200);
  };
};
