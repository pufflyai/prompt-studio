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
  original_session_id: z.string().nullable(),
  cwd: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const createSessionBodySchema = z
  .object({
    project_id: z.string().min(1),
    title: z.string().min(1),
    prompt: z.string().min(1).optional(),
    template: z.string().min(1).optional(),
    vars: z.record(z.string(), z.string()).optional(),
    agent: z.string().min(1).optional(),
    workspace_id: z.string().optional(),
    model: z.string().optional(),
    original_session_id: z.string().optional(),
  })
  .strict()
  .refine((data) => data.prompt || data.template, {
    message: "At least one of 'prompt' or 'template' is required.",
  })
  .refine((data) => !(data.prompt && data.template), {
    message: "--prompt and --template are mutually exclusive",
  });

export const followUpBodySchema = z
  .object({
    prompt: z.string().min(1).optional(),
    template: z.string().min(1).optional(),
    vars: z.record(z.string(), z.string()).optional(),
    agent: z.string().optional(),
    model: z.string().optional(),
    summary_from_session_id: z.string().optional(),
    summary_format: z.enum(["brief", "detailed"]).default("brief").optional(),
    summary_role: z.enum(["assistant", "all"]).default("assistant").optional(),
  })
  .strict()
  .refine((data) => data.prompt || data.template || data.summary_from_session_id, {
    message: "At least one of 'prompt', 'template', or 'summary_from_session_id' is required.",
  })
  .refine((data) => !(data.prompt && data.template), {
    message: "--prompt and --template are mutually exclusive",
  });

export const approveBodySchema = z
  .object({
    id: z.string().min(1).describe("The approval request ID"),
    decision: z.enum(["approve", "deny"]),
  })
  .strict();

export const notFoundResponseSchema = z.object({
  error: z.string(),
});

export const sessionConversationResponseSchema = z.object({
  session: sessionResponseSchema,
  messages: z.array(z.unknown()),
});
