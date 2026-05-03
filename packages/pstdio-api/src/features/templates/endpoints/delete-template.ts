import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { forbiddenResponseSchema, notFoundResponseSchema } from "../dto";
import { isExtensionDefaultName } from "../registry/extension-default-names";

export const deleteTemplateRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/templates/{name}",
  description:
    "Delete a project-owned template by name. Pass ?hard=true to permanently remove a soft-deleted template. Extension defaults are read-only; disable them via the extension preference endpoint instead.",
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
      error: `Template "${name}" is a read-only extension default. Disable it via the extension preference endpoint instead.`,
    };
  }
  return null;
};

export const deleteTemplateHandler = (deps: RouteDeps): AppRouteHandler<typeof deleteTemplateRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const { hard } = c.req.valid("query");

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
