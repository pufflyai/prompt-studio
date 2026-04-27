import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const pullTicketsBodySchema = z
  .object({
    ticket_id: z.string().optional(),
    force: z.boolean().optional(),
    repo_path: z.string().optional(),
  })
  .strict();

const pullTicketsResponseSchema = z.object({
  pulled_ticket_shorthands: z.array(z.string()),
  downloaded_file_count: z.number(),
  messages: z.array(z.string()),
});

const errorResponseSchema = z.object({ error: z.string() });

export const pullPlannerTicketsRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/planner/tickets/pull",
  description: "Pull tickets through the planner ticket workflow.",
  tags: ["Planner"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
    body: { content: { "application/json": { schema: pullTicketsBodySchema } } },
  },
  responses: {
    200: {
      description: "Tickets pulled.",
      content: { "application/json": { schema: pullTicketsResponseSchema } },
    },
    400: {
      description: "Planner workflow unavailable or pull failed.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const pullPlannerTicketsHandler = (deps: RouteDeps): AppRouteHandler<typeof pullPlannerTicketsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const { ticket_id, force, repo_path } = c.req.valid("json");

    const project = await deps.projectService.get(projectId);
    if (!project) {
      return c.json({ error: `Project not found: ${projectId}` }, 404);
    }

    try {
      const result = await deps.plannerService.pullTickets(projectId, {
        ticketId: ticket_id,
        force,
        repoPath: repo_path,
      });

      return c.json(
        {
          pulled_ticket_shorthands: result.pulledTicketShorthands,
          downloaded_file_count: result.downloadedFileCount,
          messages: result.messages,
        },
        200,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Planner ticket pull failed";
      return c.json({ error: message }, 400);
    }
  };
};
