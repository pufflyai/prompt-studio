import { createRoute, z } from "@hono/zod-openapi";
import { isDocsServiceError } from "pstdio-storage";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const docsContentSchema = z.object({
  link: z.string(),
  path: z.string(),
  content: z.string(),
});

export const getDocsContentRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/docs/content",
  description: "Get the content of a specific documentation page.",
  tags: ["Docs"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
    }),
    query: z.object({
      link: z.string().openapi({ description: "Documentation link path" }),
    }),
  },
  responses: {
    200: {
      description: "Document content.",
      content: { "application/json": { schema: docsContentSchema } },
    },
    404: {
      description: "Document not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const getDocsContentHandler = (deps: RouteDeps): AppRouteHandler<typeof getDocsContentRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const { link } = c.req.valid("query");

    try {
      const document = await deps.docsService.getDocument(projectId, link);
      return c.json(document, 200);
    } catch (err) {
      if (isDocsServiceError(err)) {
        return c.json({ error: err.message }, 404);
      }
      throw err;
    }
  };
};
