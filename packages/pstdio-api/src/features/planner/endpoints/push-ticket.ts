import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const pushTicketBodySchema = z
  .object({
    ticket_id: z.string(),
    status: z.string().optional(),
    tags: z.array(z.string()).optional(),
    repo_path: z.string().optional(),
  })
  .strict();

const pushTicketResponseSchema = z.object({
  ticket_id: z.string(),
  uploaded_file_count: z.number(),
  messages: z.array(z.string()),
});

const errorResponseSchema = z.object({ error: z.string() });

export const pushPlannerTicketRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/planner/tickets/push",
  description: "Push a ticket through the planner ticket workflow.",
  tags: ["Planner"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
    body: { content: { "application/json": { schema: pushTicketBodySchema } } },
  },
  responses: {
    200: {
      description: "Ticket pushed.",
      content: { "application/json": { schema: pushTicketResponseSchema } },
    },
    400: {
      description: "Planner workflow unavailable or push failed.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const pushPlannerTicketHandler = (deps: RouteDeps): AppRouteHandler<typeof pushPlannerTicketRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const { ticket_id, status, tags, repo_path } = c.req.valid("json");

    const project = await deps.projectService.get(projectId);
    if (!project) {
      return c.json({ error: `Project not found: ${projectId}` }, 404);
    }

    try {
      const result = await deps.plannerService.pushTicket(projectId, {
        ticketId: ticket_id,
        status,
        tags,
        repoPath: repo_path,
      });

      return c.json(
        {
          ticket_id: result.ticketId,
          uploaded_file_count: result.uploadedFileCount,
          messages: result.messages,
        },
        200,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Planner ticket push failed";
      return c.json({ error: message }, 400);
    }
  };
};
