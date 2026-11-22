import { createRoute, z } from "@hono/zod-openapi";
import { queryReadableSessions } from "../../../services/personal-history/queries";
import type { AppRouteHandler } from "../../../types";
import { projectQueryFields, projectQueryMessage, validProjectQuery } from "../../project-query";
import type { SessionsRouteDeps } from "../deps";
import { notFoundResponseSchema, sessionResponseSchema } from "../dto";
import { resolveSessionQueryWorkspaceId, SessionQueryWorkspaceNotFound } from "../query-sessions";
import { toSessionResponse } from "../session-response";

export const listSessionsRoute = createRoute({
  method: "get",
  path: "/sessions",
  description: "List sessions for a project. Deprecated: use GET /projects/{projectId}/sessions for bounded queries.",
  deprecated: true,
  tags: ["Sessions"],
  request: {
    query: z
      .object({
        ...projectQueryFields,
        status: z
          .enum(["in_progress", "awaiting_input", "queued", "completed", "failed", "cancelled", "disconnected"])
          .optional()
          .openapi({ description: "Filter by status" }),
        agent: z.string().optional().openapi({ description: "Filter by agent" }),
        workspace_id: z.string().optional().openapi({ description: "Filter by linked workspace ID or shorthand" }),
        created_from: z.string().datetime({ offset: true }).optional(),
        created_to: z.string().datetime({ offset: true }).optional(),
        updated_from: z.string().datetime({ offset: true }).optional(),
        anchor_type: z.string().optional(),
        anchor_id: z.string().optional(),
        archived: z.string().optional().openapi({ description: "Include archived" }),
      })
      .strict()
      .refine(validProjectQuery, { message: projectQueryMessage })
      .refine((input) => Boolean(input.anchor_type) === Boolean(input.anchor_id), {
        message: "Provide both anchor_type and anchor_id",
      }),
  },
  responses: {
    404: {
      description: "Workspace not found in this project.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    200: {
      description: "List of sessions.",
      content: { "application/json": { schema: z.array(sessionResponseSchema) } },
    },
  },
});

export const listSessionsHandler = (deps: SessionsRouteDeps): AppRouteHandler<typeof listSessionsRoute> => {
  return async (c) => {
    const query = c.req.valid("query");

    const projectId = (query.projectId ?? query.project_id)!;
    let workspaceId: string | undefined;
    try {
      workspaceId = await resolveSessionQueryWorkspaceId(deps, projectId, query.workspace_id, c.req.raw.signal);
    } catch (error) {
      if (error instanceof SessionQueryWorkspaceNotFound) return c.json({ error: error.message }, 404);
      throw error;
    }
    const page = await queryReadableSessions(
      deps,
      projectId,
      {
        status: query.status ? [query.status] : undefined,
        agent: query.agent,
        workspaceId,
        includeArchived: query.archived === "true",
        createdFrom: query.created_from,
        createdTo: query.created_to,
        updatedFrom: query.updated_from,
        anchor: query.anchor_type && query.anchor_id ? { type: query.anchor_type, id: query.anchor_id } : undefined,
      },
      { unpaged: true },
    );
    return c.json(
      page.rows.map((row) => toSessionResponse(row, row.workspace_id)),
      200,
    );
  };
};
