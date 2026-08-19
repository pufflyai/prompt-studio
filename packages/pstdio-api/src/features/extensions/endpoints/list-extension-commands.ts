import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { listExtensionCommandsResponseSchema } from "pstdio-api-contracts";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppBindings, AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { toCommandRecord } from "../extension-command-record";

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

export const listExtensionCommandsHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof listExtensionCommandsRoute> => {
  const handler = async (c: Context<AppBindings>) => {
    const { projectId } = c.req.param();

    try {
      const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
      return c.json(
        {
          commands: snapshot.runtime.commands.map(toCommandRecord),
          translations: snapshot.runtime.translations,
          diagnostics: snapshot.runtime.diagnostics,
        },
        200,
      );
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };

  return handler as AppRouteHandler<typeof listExtensionCommandsRoute>;
};
