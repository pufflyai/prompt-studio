import { z } from "@hono/zod-openapi";

export const ticketResponseSchema = z.object({
  id: z.string(),
  shorthand: z.string(),
  project_id: z.string(),
  status_id: z.string().nullable(),
  title: z.string().nullable(),
  input: z.string().nullable(),
  priority: z.string().nullable(),
  complexity: z.string().nullable(),
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

export const ticketListItemSchema = ticketResponseSchema.extend({
  status_name: z.string().nullable(),
  tag_names: z.array(z.string()),
});

export const createTicketBodySchema = z.object({
  project_id: z.string().min(1),
  title: z.string().optional(),
  input: z.string().optional(),
  priority: z.string().optional(),
  complexity: z.enum(["low", "medium", "high"]).optional(),
  parent_id: z.string().optional(),
  draft: z.boolean().optional(),
  tag_ids: z.array(z.string()).optional(),
  status_id: z.string().optional(),
});

export const updateTicketBodySchema = z.object({
  title: z.string().optional(),
  input: z.string().optional(),
  status_id: z.string().optional(),
  priority: z.string().optional(),
  complexity: z.enum(["low", "medium", "high"]).optional(),
  draft: z.boolean().optional(),
  archived: z.boolean().optional(),
  tag_ids: z.array(z.string()).optional(),
});

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

export const uploadTicketFileBodySchema = z.object({
  file_name: z.string().min(1),
  content_base64: z.string(),
  mime_type: z.string().optional(),
});
