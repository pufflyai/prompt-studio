import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { sessionResponseSchema } from "../dto";

export const listSessionsRoute = createRoute({
  method: "get",
  path: "/sessions",
  description: "List sessions for a project.",
  tags: ["Sessions"],
  request: {
    query: z
      .object({
        project_id: z.string().openapi({ description: "Project ID" }),
        status: z
          .enum(["in_progress", "awaiting_input", "queued", "completed", "failed", "cancelled", "disconnected"])
          .optional()
          .openapi({ description: "Filter by status" }),
        agent: z.string().optional().openapi({ description: "Filter by agent" }),
        workspace_id: z.string().optional().openapi({ description: "Filter by linked workspace" }),
        created_from: z.string().datetime({ offset: true }).optional(),
        created_to: z.string().datetime({ offset: true }).optional(),
        updated_from: z.string().datetime({ offset: true }).optional(),
        anchor_type: z.string().optional(),
        anchor_id: z.string().optional(),
        archived: z.string().optional().openapi({ description: "Include archived" }),
      })
      .strict()
      .refine((input) => Boolean(input.anchor_type) === Boolean(input.anchor_id), {
        message: "Provide both anchor_type and anchor_id",
      }),
  },
  responses: {
    200: {
      description: "List of sessions.",
      content: { "application/json": { schema: z.array(sessionResponseSchema) } },
    },
  },
});

export const listSessionsHandler = (deps: SessionsRouteDeps): AppRouteHandler<typeof listSessionsRoute> => {
  return async (c) => {
    const query = c.req.valid("query");

    const page = await deps.sessionService.query(
      query.project_id,
      {
        status: query.status ? [query.status] : undefined,
        agent: query.agent,
        workspaceId: query.workspace_id,
        includeArchived: query.archived === "true",
        createdFrom: query.created_from,
        createdTo: query.created_to,
        updatedFrom: query.updated_from,
        anchor: query.anchor_type && query.anchor_id ? { type: query.anchor_type, id: query.anchor_id } : undefined,
      },
      { unpaged: true },
    );
    return c.json(page.rows, 200);
  };
};
