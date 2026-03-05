import { z } from "@hono/zod-openapi";

export const sessionResponseSchema = z.object({
  id: z.string(),
  project_id: z.string().nullable(),
  title: z.string(),
  status: z.enum(["in_progress", "awaiting_input", "completed", "failed", "cancelled"]),
  archived: z.boolean(),
  created: z.string().nullable(),
  last_request_started: z.string().nullable(),
  last_request_ended: z.string().nullable(),
  agent: z.string().nullable(),
  agent_session_id: z.string().nullable(),
  session_file_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const createSessionBodySchema = z.object({
  project_id: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  agent: z.string().min(1),
  workspace_id: z.string().optional(),
  model: z.string().optional(),
});

export const followUpBodySchema = z.object({
  prompt: z.string().min(1),
  agent: z.string().optional(),
  model: z.string().optional(),
});

export const approveBodySchema = z.object({
  id: z.string().min(1).describe("The approval request ID"),
  decision: z.enum(["approve", "deny"]),
});

export const notFoundResponseSchema = z.object({
  error: z.string(),
});
