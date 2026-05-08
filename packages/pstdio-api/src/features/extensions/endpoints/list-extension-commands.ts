import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { listExtensionCommandsResponseSchema } from "pstdio-api-contracts";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppBindings } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { loadProjectExtensionRuntime, toCommandRecord } from "../extension-command-runtime";

const errorSchema = z.object({ error: z.string() });

export const listExtensionCommandsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/commands",
  description: "List command metadata for enabled project extensions.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string().openapi({ description: "Project ID" }) }).strict(),
  },
  responses: {
    200: {
      description: "Enabled extension commands.",
      content: { "application/json": { schema: listExtensionCommandsResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const listExtensionCommandsHandler = (deps: ExtensionsRouteDeps) => {
  return async (c: Context<AppBindings>) => {
    const { projectId } = c.req.param();

    try {
      const { runtime } = await loadProjectExtensionRuntime(deps, projectId);
      return c.json(
        {
          commands: runtime.commands.map(toCommandRecord),
          diagnostics: runtime.diagnostics,
        },
        200,
      );
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };
};
