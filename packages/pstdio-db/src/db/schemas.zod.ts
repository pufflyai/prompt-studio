import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  sessions,
  ticket_tag_options,
  ticket_tags,
  tickets,
  workspaces,
  ydocAwareness,
  ydocResumeState,
  ydocUpdates,
} from "./schemas.pg";

export const ticketSelectSchema = createSelectSchema(tickets);

export const sessionSelectSchema = createSelectSchema(sessions, {
  status: z.enum(["in_progress", "awaiting_input", "completed", "failed", "cancelled", "disconnected"]),
});

export const ticketTagSelectSchema = createSelectSchema(ticket_tags);
export const ticketTagOptionSelectSchema = createSelectSchema(ticket_tag_options);
export const workspaceSelectSchema = createSelectSchema(workspaces);

export const ticketAttemptSchema = z.object({
  id: z.string(),
  label: z.string(),
  attempt_status_id: z.string().nullable(),
  updated_at: z.string(),
});

export const ticketSubTicketSchema = z.object({
  id: z.string(),
  shorthand: z.string(),
  status_id: z.string().nullable(),
  display_title: z.string().nullable(),
});

export const ticketApiSchema = ticketSelectSchema.extend({
  attempts: z.array(ticketAttemptSchema).optional(),
  tag_ids: z.array(z.string()).optional(),
  sub_tickets: z.array(ticketSubTicketSchema).optional(),
});

export const workspaceApiSchema = workspaceSelectSchema.extend({
  ticket_id: z.string().nullable(),
});

export const sessionApiSchema = sessionSelectSchema.extend({
  agent_session_status: z.enum(["connected", "disconnected", "not_connected"]).optional(),
  branch: z.string().nullable(),
  repo_id: z.string().nullable(),
  workspace_id: z.string().nullable(),
  worktree_path: z.string().nullable(),
});

export const createTicketBodySchema = ticketSelectSchema
  .omit({
    created_at: true,
    deleted_at: true,
    id: true,
    shorthand: true,
    updated_at: true,
  })
  .partial()
  .required({ project_id: true })
  .strict();

export const updateTicketBodySchema = ticketSelectSchema
  .omit({
    created_at: true,
    deleted_at: true,
    id: true,
    project_id: true,
    shorthand: true,
    updated_at: true,
  })
  .partial()
  .strict();

export const ydocUpdatesSelectSchema = createSelectSchema(ydocUpdates);
export const ydocAwarenessSelectSchema = createSelectSchema(ydocAwareness);
export const ydocResumeStateSelectSchema = createSelectSchema(ydocResumeState);
