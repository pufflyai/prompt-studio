import fs from "node:fs";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

export const getStartupLogRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/startup-log",
  description: "Retrieve the startup log for a workspace.",
  tags: ["Workspaces"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Workspace ID" }),
    }),
  },
  responses: {
    200: {
      description: "Startup log content.",
      content: { "text/plain": { schema: z.string() } },
    },
    404: {
      description: "Workspace or log not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getStartupLogHandler = (deps: RouteDeps): AppRouteHandler<typeof getStartupLogRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const workspace = await deps.workspacesService.get(id);
    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    if (!workspace.startup_log_file_id) {
      return c.json({ error: "No startup log for this workspace." }, 404);
    }

    const file = await deps.filesService.get(workspace.startup_log_file_id);
    if (!file) {
      return c.json({ error: "Startup log file not found." }, 404);
    }

    const content = fs.readFileSync(file.storage_path, "utf8");
    return c.text(content, 200);
  };
};
