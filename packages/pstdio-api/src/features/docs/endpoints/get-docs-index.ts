import { createRoute, z } from "@hono/zod-openapi";
import { isDocsServiceError } from "pstdio-storage";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const docsSidebarItemSchema: z.ZodType = z
  .lazy(() =>
    z.object({
      text: z.string(),
      link: z.string().optional(),
      template: z.string().optional(),
      items: z.array(docsSidebarItemSchema).optional(),
    }),
  )
  .openapi("DocsSidebarItem");

const docsIndexSchema = z.object({
  sidebar: z.array(docsSidebarItemSchema),
  missingLinks: z.array(z.string()),
});

export const getDocsIndexRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/docs",
  description: "Get the docs navigation index for a project.",
  tags: ["Docs"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Docs index.",
      content: { "application/json": { schema: docsIndexSchema } },
    },
    404: {
      description: "Docs not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const getDocsIndexHandler = (deps: RouteDeps): AppRouteHandler<typeof getDocsIndexRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");

    try {
      const index = await deps.docService.getIndex(projectId);
      return c.json(index, 200);
    } catch (err) {
      if (isDocsServiceError(err)) {
        return c.json({ error: err.message }, 404);
      }
      throw err;
    }
  };
};
