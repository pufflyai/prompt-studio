import { z } from "@hono/zod-openapi";
import { workspaceResponseSchema } from "../workspaces/dto";

export const ticketResponseSchema = z.object({
  id: z.string(),
  shorthand: z.string(),
  project_id: z.string(),
  status_id: z.string().nullable(),
  display_title: z.string().nullable(),
  user_prompt: z.string().nullable(),
  file_id: z.string().nullable(),
  priority: z.string().nullable(),
  complexity: z.enum(["low", "medium", "high"]).nullable(),
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

export const ticketDetailResponseSchema = ticketResponseSchema.extend({
  content: z.string(),
});

export const ticketListItemSchema = ticketResponseSchema.extend({
  status_name: z.string().nullable(),
  tag_ids: z.array(z.string()),
  tag_names: z.array(z.string()),
});

export const createTicketBodySchema = z
  .object({
    project_id: z.string().min(1),
    content: z.string().optional(),
    user_prompt: z.string().optional(),
    file_id: z.string().optional(),
    priority: z.string().optional(),
    complexity: z.enum(["low", "medium", "high"]).optional(),
    parent_id: z.string().optional(),
    draft: z.boolean().optional(),
    tag_ids: z.array(z.string()).optional(),
    status_id: z.string().optional(),
  })
  .strict();

export const updateTicketBodySchema = z
  .object({
    content: z.string().optional(),
    display_title: z.string().optional(),
    user_prompt: z.string().optional(),
    file_id: z.string().optional(),
    status_id: z.string().optional(),
    priority: z.string().optional(),
    complexity: z.enum(["low", "medium", "high"]).optional(),
    draft: z.boolean().optional(),
    archived: z.boolean().optional(),
    tag_ids: z.array(z.string()).optional(),
  })
  .strict();

export const notFoundResponseSchema = z.object({
  error: z.string(),
});

export const ticketFileResponseSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  file_name: z.string(),
  file_kind: z.string(),
  storage_path: z.string(),
  mime_type: z.string().nullable(),
  size_bytes: z.number(),
  hash: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const uploadTicketFileBodySchema = z
  .object({
    file_name: z.string().min(1),
    content_base64: z.string(),
    mime_type: z.string().optional(),
  })
  .strict();

export const ticketAttemptModeSchema = z.enum(["worktree", "current_branch"]);

export const createTicketAttemptBodySchema = z
  .object({
    agent: z.string().min(1).optional(),
    branch: z.string().optional(),
    repo_id: z.string().optional(),
    repo_path: z.string().optional(),
    mode: ticketAttemptModeSchema.optional(),
    model: z.string().optional(),
    prompt: z.string().nullable().optional(),
    base: z.string().optional(),
    start_session: z.boolean().optional(),
  })
  .strict();

const ticketAttemptSessionSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ticketAttemptResponseSchema = z.object({
  mode: ticketAttemptModeSchema,
  ticket: ticketResponseSchema,
  workspace: workspaceResponseSchema,
  session: ticketAttemptSessionSchema.nullable(),
});
