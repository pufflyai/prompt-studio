import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { forbiddenResponseSchema, notFoundResponseSchema } from "../dto";
import { isExtensionDefaultName } from "../registry/extension-default-names";

export const deleteTemplateRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/templates/{name}",
  description:
    "Delete a project-owned template by name. Pass ?hard=true to permanently remove a soft-deleted template. Extension defaults can only be removed via `pstdio extensions remove`.",
  tags: ["Templates"],
  request: {
    query: z
      .object({
        hard: z.literal("true").optional().openapi({ description: "Permanently delete the record" }),
      })
      .strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z.string().openapi({ description: "Template name" }),
      })
      .strict(),
  },
  responses: {
    204: {
      description: "Template deleted.",
    },
    403: {
      description: "Template is a read-only extension default.",
      content: { "application/json": { schema: forbiddenResponseSchema } },
    },
    404: {
      description: "Template not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

const rejectExtensionDefault = async (deps: RouteDeps, name: string) => {
  if (await isExtensionDefaultName(deps, name)) {
    return {
      error: `Template "${name}" is provided by an extension. Remove it via \`pstdio extensions remove\` instead.`,
    };
  }
  return null;
};

export const deleteTemplateHandler = (deps: RouteDeps): AppRouteHandler<typeof deleteTemplateRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const { hard } = c.req.valid("query");

    // Refuse to delete extension-owned rows up front — they're materialized
    // by the sync flow and can only be removed via `pstdio extensions remove`.
    const existing = await deps.templateService.getByName(projectId, name);
    if (existing?.extension_id) {
      return c.json(
        {
          error: `Template "${name}" is provided by an extension. Remove it via \`pstdio extensions remove\` instead.`,
        },
        403,
      );
    }

    if (hard === "true") {
      const removed = await deps.templateService.hardRemove(projectId, name);
      if (!removed) {
        const blocked = await rejectExtensionDefault(deps, name);
        if (blocked) return c.json(blocked, 403);
        return c.json({ error: `Template not found: ${name}` }, 404);
      }
      return c.body(null, 204);
    }

    const removed = await deps.templateService.remove(projectId, name);

    if (!removed) {
      const blocked = await rejectExtensionDefault(deps, name);
      if (blocked) return c.json(blocked, 403);
      return c.json({ error: `Template not found: ${name}` }, 404);
    }

    deps.eventBus.emit("templates", "set", removed);

    return c.body(null, 204);
  };
};
