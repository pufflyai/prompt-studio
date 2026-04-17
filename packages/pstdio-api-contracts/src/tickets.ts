import { z } from "zod";

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

export const ticketDetailSchema = ticketSchema.extend({
  content: z.string(),
});

export const ticketListItemSchema = ticketSchema.extend({
  status_name: z.string().nullable(),
  tag_ids: z.array(z.string()),
  tag_names: z.array(z.string()),
});

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

export const uploadTicketFileInputSchema = z.object({
  file_name: z.string().min(1),
  relative_path: z.string().min(1).optional(),
  content_base64: z.string(),
  mime_type: z.string().optional(),
});

export const ticketAttemptModeSchema = z.enum(["worktree", "current_branch"]);

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

export const updateWhenAttemptStatusInputSchema = z.object({
  all_attempts_status: z.string(),
  set_status: z.string(),
});

export const updateWhenAttemptStatusResponseSchema = z.object({
  updated: z.boolean(),
});

export type Ticket = z.infer<typeof ticketSchema>;
export type TicketDetail = z.infer<typeof ticketDetailSchema>;
export type TicketListItem = z.infer<typeof ticketListItemSchema>;
export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketInputSchema>;
export type UploadTicketFileInput = z.infer<typeof uploadTicketFileInputSchema>;
export type TicketAttemptMode = z.infer<typeof ticketAttemptModeSchema>;
export type CreateTicketAttemptInput = z.infer<typeof createTicketAttemptInputSchema>;
export type UpdateWhenAttemptStatusInput = z.infer<typeof updateWhenAttemptStatusInputSchema>;
export type UpdateWhenAttemptStatusResponse = z.infer<typeof updateWhenAttemptStatusResponseSchema>;
