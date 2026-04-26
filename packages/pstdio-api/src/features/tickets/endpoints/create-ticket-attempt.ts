import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { emitActivityEvent } from "../../activity/activity-events";
import type { RouteDeps } from "../../deps";
import { createTicketAttemptBodySchema, notFoundResponseSchema, ticketAttemptResponseSchema } from "../dto";
import {
  buildCreateTicketAttemptResponse,
  continueTicketAttemptSetup,
  createAttemptWorkspace,
  resolveCreateTicketAttemptContext,
  resolveSessionCwd,
  startOptionalAttemptSession,
} from "./create-ticket-attempt.utils";

const badRequestSchema = z.object({ error: z.string() });

export const createTicketAttemptRoute = createRoute({
  method: "post",
  path: "/tickets/{id}/attempts",
  description: "Create a ticket attempt workspace and optionally start a session.",
  tags: ["Tickets"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Ticket ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: createTicketAttemptBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Ticket attempt created.",
      content: { "application/json": { schema: ticketAttemptResponseSchema } },
    },
    400: {
      description: "Invalid request.",
      content: { "application/json": { schema: badRequestSchema } },
    },
    404: {
      description: "Ticket or repo not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const createTicketAttemptHandler = (deps: RouteDeps): AppRouteHandler<typeof createTicketAttemptRoute> => {
  const worktreeMode = "worktree";

  return async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const context = await resolveCreateTicketAttemptContext(deps, id, input, worktreeMode);

    if ("error" in context) {
      return c.json({ error: context.error.message }, context.error.status);
    }

    const workspaceWithGitMetadata = await createAttemptWorkspace(deps, {
      projectId: context.ticket.project_id,
      ticketId: context.ticket.id,
      ticketShorthand: context.ticket.shorthand,
      mode: context.mode,
      worktreeMode,
      repoPath: context.repo.path,
      base: context.base,
    });

    const cwd = resolveSessionCwd({
      mode: context.mode,
      worktreeMode,
      repoPath: context.repo.path,
      worktreePath: workspaceWithGitMetadata.worktree_path,
    });

    const sessionStart = await startOptionalAttemptSession(deps, {
      ticket: context.ticket,
      workspace: workspaceWithGitMetadata,
      cwd,
      request: input,
    });

    if ("error" in sessionStart) {
      return c.json({ error: sessionStart.error.message }, sessionStart.error.status);
    }

    continueTicketAttemptSetup(deps, {
      workspace: workspaceWithGitMetadata,
      ticketShorthand: context.ticket.shorthand,
      repo: context.repo,
      mode: context.mode,
      worktreeMode,
      started: sessionStart.started,
      model: input.model ?? undefined,
    });

    await emitActivityEvent(deps, {
      projectId: context.ticket.project_id,
      resourceType: "ticket",
      resourceId: context.ticket.id,
      eventType: "ticket_attempt_created",
      summary: `Created attempt for ${context.ticket.shorthand}`,
      payload: {
        mode: context.mode,
        workspace_id: workspaceWithGitMetadata.id,
        session_id: sessionStart.started?.session.id ?? null,
      },
    });

    return c.json(
      buildCreateTicketAttemptResponse({
        mode: context.mode,
        ticket: context.ticket,
        workspace: workspaceWithGitMetadata,
        started: sessionStart.started,
      }),
      201,
    );
  };
};
