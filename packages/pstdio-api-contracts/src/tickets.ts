import { z } from "zod";
import { listActivityInputSchema, listActivityResponseSchema, listProjectActivityInputSchema } from "./activity";

/** @deprecated Legacy core ticket data. Ticket data is owned by the pstdio tickets extension. */
export const ticketSchema = z.object({
  id: z.string(),
  shorthand: z.string(),
  project_id: z.string(),
  status_id: z.string().nullable(),
  display_title: z.string().nullable(),
  user_prompt: z.string().nullable(),
  file_id: z.string().nullable(),
  parent_id: z.string().nullable(),
  parallelizable: z.string().nullable(),
  blocked_reason: z.string().nullable(),
  depends_on: z.string().nullable(),
  draft: z.boolean(),
  archived: z.boolean(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** @deprecated Legacy core ticket data. Ticket data is owned by the pstdio tickets extension. */
export const ticketDetailSchema = ticketSchema.extend({
  content: z.string(),
});

/** @deprecated Legacy core ticket data. Ticket data is owned by the pstdio tickets extension. */
export const ticketListItemSchema = ticketSchema.extend({
  status_name: z.string().nullable(),
  tag_ids: z.array(z.string()),
  tag_names: z.array(z.string()),
});

/** @deprecated Legacy core ticket data. Ticket data is owned by the pstdio tickets extension. */
export const createTicketInputSchema = z.object({
  project_id: z.string().min(1),
  content: z.string().optional(),
  user_prompt: z.string().optional(),
  file_id: z.string().optional(),
  parent_id: z.string().optional(),
  draft: z.boolean().optional(),
  tag_ids: z.array(z.string()).optional(),
  status_id: z.string().optional(),
});

/** @deprecated Legacy core ticket data. Ticket data is owned by the pstdio tickets extension. */
export const updateTicketInputSchema = z.object({
  content: z.string().optional(),
  display_title: z.string().optional(),
  user_prompt: z.string().optional(),
  file_id: z.string().optional(),
  parent_id: z.string().optional(),
  status_id: z.string().optional(),
  blocked_reason: z.string().nullable().optional(),
  draft: z.boolean().optional(),
  archived: z.boolean().optional(),
  tag_ids: z.array(z.string()).optional(),
});

/** @deprecated Legacy core ticket files. Ticket attachments are owned by the pstdio tickets extension. */
export const uploadTicketFileInputSchema = z.object({
  file_name: z.string().min(1),
  relative_path: z.string().min(1).optional(),
  content_base64: z.string(),
  mime_type: z.string().optional(),
});

/** @deprecated Legacy core ticket attempts. Ticket attempts are owned by the pstdio tickets extension. */
export const ticketAttemptModeSchema = z.enum(["worktree", "current_branch"]);

/** @deprecated Legacy core ticket attempts. Ticket attempts are owned by the pstdio tickets extension. */
export const createTicketAttemptInputSchema = z.object({
  agent: z.string().min(1).optional(),
  branch: z.string().optional(),
  repo_id: z.string().optional(),
  repo_path: z.string().optional(),
  mode: ticketAttemptModeSchema.optional(),
  model: z.string().optional(),
  prompt: z.string().nullable().optional(),
  base: z.string().optional(),
  start_session: z.boolean().optional(),
});

/** @deprecated Legacy core ticket status automation. Ticket statuses are owned by the pstdio tickets extension. */
export const updateWhenAttemptStatusInputSchema = z.object({
  all_attempts_status: z.string(),
  set_status: z.string(),
});

/** @deprecated Legacy core ticket status automation. Ticket statuses are owned by the pstdio tickets extension. */
export const updateWhenAttemptStatusResponseSchema = z.object({
  updated: z.boolean(),
});

/** @deprecated Legacy core ticket activity. Ticket activity is owned by the pstdio tickets extension. */
export const listTicketActivityInputSchema = listActivityInputSchema;
/** @deprecated Legacy core ticket activity. Ticket activity is owned by the pstdio tickets extension. */
export const listProjectActivityForTicketsInputSchema = listProjectActivityInputSchema;
/** @deprecated Legacy core ticket activity. Ticket activity is owned by the pstdio tickets extension. */
export const listTicketActivityResponseSchema = listActivityResponseSchema;

/** @deprecated Legacy core ticket data. Ticket data is owned by the pstdio tickets extension. */
export type Ticket = z.infer<typeof ticketSchema>;
/** @deprecated Legacy core ticket data. Ticket data is owned by the pstdio tickets extension. */
export type TicketDetail = z.infer<typeof ticketDetailSchema>;
/** @deprecated Legacy core ticket data. Ticket data is owned by the pstdio tickets extension. */
export type TicketListItem = z.infer<typeof ticketListItemSchema>;
/** @deprecated Legacy core ticket data. Ticket data is owned by the pstdio tickets extension. */
export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;
/** @deprecated Legacy core ticket data. Ticket data is owned by the pstdio tickets extension. */
export type UpdateTicketInput = z.infer<typeof updateTicketInputSchema>;
/** @deprecated Legacy core ticket files. Ticket attachments are owned by the pstdio tickets extension. */
export type UploadTicketFileInput = z.infer<typeof uploadTicketFileInputSchema>;
/** @deprecated Legacy core ticket attempts. Ticket attempts are owned by the pstdio tickets extension. */
export type TicketAttemptMode = z.infer<typeof ticketAttemptModeSchema>;
/** @deprecated Legacy core ticket attempts. Ticket attempts are owned by the pstdio tickets extension. */
export type CreateTicketAttemptInput = z.infer<typeof createTicketAttemptInputSchema>;
/** @deprecated Legacy core ticket status automation. Ticket statuses are owned by the pstdio tickets extension. */
export type UpdateWhenAttemptStatusInput = z.infer<typeof updateWhenAttemptStatusInputSchema>;
/** @deprecated Legacy core ticket status automation. Ticket statuses are owned by the pstdio tickets extension. */
export type UpdateWhenAttemptStatusResponse = z.infer<typeof updateWhenAttemptStatusResponseSchema>;
/** @deprecated Legacy core ticket activity. Ticket activity is owned by the pstdio tickets extension. */
export type ListTicketActivityInput = z.infer<typeof listTicketActivityInputSchema>;
/** @deprecated Legacy core ticket activity. Ticket activity is owned by the pstdio tickets extension. */
export type ListProjectActivityForTicketsInput = z.infer<typeof listProjectActivityForTicketsInputSchema>;
/** @deprecated Legacy core ticket activity. Ticket activity is owned by the pstdio tickets extension. */
export type ListTicketActivityResponse = z.infer<typeof listTicketActivityResponseSchema>;
