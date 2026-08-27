import { z } from "zod";
import { listActivityInputSchema, listActivityResponseSchema } from "./activity";
import { extensionResourceRefSchema } from "./extensions";

export const sessionStatusSchema = z.enum([
  "in_progress",
  "awaiting_input",
  "queued",
  "completed",
  "failed",
  "cancelled",
  "disconnected",
]);

export const harnessParamValueSchema = z.union([z.string(), z.boolean()]);
export const harnessParamsInputSchema = z.record(z.string(), harnessParamValueSchema);

export const sessionSchema = z.object({
  id: z.string(),
  project_id: z.string().nullable(),
  title: z.string(),
  status: sessionStatusSchema,
  archived: z.boolean(),
  last_request_started: z.string().nullable(),
  last_request_ended: z.string().nullable(),
  agent: z.string().nullable(),
  last_selected_model: z.string().nullable(),
  agent_session_id: z.string().nullable(),
  session_file_id: z.string().nullable(),
  original_session_id: z.string().nullable(),
  cwd: z.string().nullable(),
  params_json: harnessParamsInputSchema.nullable(),
  anchors_json: z.array(extensionResourceRefSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export const sessionAttachmentRefSchema = z.object({
  file_id: z.string().min(1),
});

export const sessionAttachmentSchema = z.object({
  file_id: z.string(),
  name: z.string(),
  mime_type: z.string().nullable(),
  size_bytes: z.number(),
  hash: z.string().nullable(),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const createSessionInputSchema = z.object({
  project_id: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1).optional(),
  agent: z.string().min(1).optional(),
  workspace_id: z.string().optional(),
  anchors: z.array(extensionResourceRefSchema).optional(),
  attachments: z.array(sessionAttachmentRefSchema).optional(),
  model: z.string().optional(),
  params: harnessParamsInputSchema.optional(),
  original_session_id: z.string().optional(),
});

export const questionResponseSchema = z.object({
  answers: z.array(z.array(z.string())),
});

export const followUpInputSchema = z.object({
  prompt: z.string().min(1).optional(),
  agent: z.string().optional(),
  model: z.string().optional(),
  question_response: questionResponseSchema.optional(),
  params: harnessParamsInputSchema.optional(),
  summary_from_session_id: z.string().optional(),
  summary_format: z.enum(["brief", "detailed"]).default("brief").optional(),
  summary_role: z.enum(["assistant", "all"]).default("assistant").optional(),
  attachments: z.array(sessionAttachmentRefSchema).optional(),
});

export const approvalInputSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["approve", "deny"]),
});

export const followUpDecisionSchema = z.union([
  z.object({ status: z.literal("dispatched") }),
  z.object({ status: z.literal("queued"), queue_position: z.number().int() }),
]);

export const followUpResponseSchema = sessionSchema.extend({
  follow_up: followUpDecisionSchema,
});

export const sessionConversationResponseSchema = z.object({
  session: sessionSchema,
  messages: z.array(z.unknown()),
});

export const resolveSessionIdInputSchema = z.object({
  agent: z.string(),
  agent_session_id: z.string(),
  cwd: z.string().optional(),
});

export const resolveSessionIdResponseSchema = z.object({
  session_id: z.string().nullable(),
});

export const listSessionActivityInputSchema = listActivityInputSchema;
export const listSessionActivityResponseSchema = listActivityResponseSchema;

export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type ResolveSessionIdInput = z.infer<typeof resolveSessionIdInputSchema>;
export type ResolveSessionIdResponse = z.infer<typeof resolveSessionIdResponseSchema>;
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
export type FollowUpInput = z.infer<typeof followUpInputSchema>;
export type HarnessParamsInput = z.infer<typeof harnessParamsInputSchema>;
export type SessionAttachment = z.infer<typeof sessionAttachmentSchema>;
export type SessionAttachmentRef = z.infer<typeof sessionAttachmentRefSchema>;
export type ApprovalInput = z.infer<typeof approvalInputSchema>;
export type SessionConversationResponse = z.infer<typeof sessionConversationResponseSchema>;
export type ListSessionActivityInput = z.infer<typeof listSessionActivityInputSchema>;
export type ListSessionActivityResponse = z.infer<typeof listSessionActivityResponseSchema>;
export type FollowUpDecision = z.infer<typeof followUpDecisionSchema>;
export type FollowUpResponse = z.infer<typeof followUpResponseSchema>;
