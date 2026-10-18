import { z } from "zod";
import { listActivityInputSchema, listActivityResponseSchema } from "./activity";
import type { SessionExit } from "./extension-kernel/types/sessions";
import { extensionResourceRefSchema } from "./extensions";
import { harnessOperationResponseSchema, harnessOperationSchema } from "./harness-commands";
import { pendingQueuedFollowUpsResponseSchema } from "./queued-follow-ups";
import { sessionMessageSchema } from "./session-messages";

export const sessionStatusSchema = z.enum([
  "in_progress",
  "awaiting_input",
  "queued",
  "completed",
  "failed",
  "cancelled",
  "disconnected",
]);

export {
  harnessParamsInputSchema,
  harnessParamValueSchema,
  sessionAttachmentRefSchema,
} from "./session-request-values";

import { harnessParamsInputSchema, sessionAttachmentRefSchema } from "./session-request-values";

export const sessionUsageSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_read_tokens: z.number(),
  cache_write_tokens: z.number(),
});

export const sessionExitSchema: z.ZodType<SessionExit> = z.object({
  cause: z.enum([
    "completed",
    "user_stop",
    "request_aborted",
    "worker_lost",
    "host_shutdown",
    "timeout",
    "failed",
    "unknown",
  ]),
  startedAt: z.string().nullable(),
  endedAt: z.string(),
});

export const extensionSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: sessionStatusSchema,
  archived: z.boolean(),
  agent: z.string().nullable(),
  cwd: z.string().nullable(),
  lastSelectedModel: z.string().nullable(),
  workspaceId: z.string().nullable(),
  originalSessionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastRequestStarted: z.string().nullable(),
  lastRequestEnded: z.string().nullable(),
  lastExit: sessionExitSchema.nullable().optional(),
  usage: z
    .object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      cacheReadTokens: z.number(),
      cacheWriteTokens: z.number(),
    })
    .nullable(),
});

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
  usage_json: sessionUsageSchema.nullable().optional(),
  workspace_id: z.string().nullable().optional(),
  anchors_json: z.array(extensionResourceRefSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export const sessionDetailsSchema = extensionSessionSchema.extend({
  projectId: z.string().nullable(),
  agentSessionId: z.string().nullable(),
  sessionFileId: z.string().nullable(),
  params: harnessParamsInputSchema.nullable(),
});
export type SessionDetails = z.infer<typeof sessionDetailsSchema>;

export const createSessionResponseSchema = sessionSchema.extend(extensionSessionSchema.shape).extend({
  operation_result: harnessOperationResponseSchema.optional(),
});
/** @deprecated Use SessionCreateResponse for canonical response fields. */
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;
export const sessionCreateResponseSchema = createSessionResponseSchema.extend(sessionDetailsSchema.shape).extend({
  operationResult: harnessOperationResponseSchema.optional(),
});
export type SessionCreateResponse = z.infer<typeof sessionCreateResponseSchema>;

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
  prompt: z.string().optional(),
  operation: harnessOperationSchema.optional(),
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
  callId: z.string().min(1).optional(),
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

export const sessionQueuedMessagesResponseSchema = z.object({
  messages: z.array(sessionMessageSchema),
  queue: pendingQueuedFollowUpsResponseSchema.optional(),
});
export type SessionQueuedMessagesResponse = z.infer<typeof sessionQueuedMessagesResponseSchema>;

export const sessionConversationSourcesSchema = z.object({
  checkpoint: z.array(sessionMessageSchema).nullable(),
  native: z.array(sessionMessageSchema).nullable(),
  checkpointError: z.string().nullable(),
  nativeError: z.string().nullable(),
});

export type SessionConversationSources = z.infer<typeof sessionConversationSourcesSchema>;

export const sessionConversationResponseSchema = z.object({
  session: sessionSchema,
  messages: z.array(sessionMessageSchema),
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
/** @deprecated Use SessionDetails or ExtensionSession. Legacy fields stay available through 0.44. */
export type Session = z.infer<typeof sessionSchema>;
export type ResolveSessionIdInput = z.infer<typeof resolveSessionIdInputSchema>;
export type ResolveSessionIdResponse = z.infer<typeof resolveSessionIdResponseSchema>;
/** @deprecated Use SessionCreateRequest with projectId first. Legacy fields stay available through 0.44. */
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
/** @deprecated Use SessionFollowUpRequest. Legacy fields stay available through 0.44. */
export type FollowUpInput = z.infer<typeof followUpInputSchema>;
export type HarnessParamsInput = z.infer<typeof harnessParamsInputSchema>;
/** @deprecated Use SessionAttachmentDetails. Legacy fields stay available through 0.44. */
export type SessionAttachment = z.infer<typeof sessionAttachmentSchema>;
export type SessionAttachmentRef = z.infer<typeof sessionAttachmentRefSchema>;
export type ApprovalInput = z.infer<typeof approvalInputSchema>;
export type SessionConversationResponse = z.infer<typeof sessionConversationResponseSchema>;
export type ListSessionActivityInput = z.infer<typeof listSessionActivityInputSchema>;
export type ListSessionActivityResponse = z.infer<typeof listSessionActivityResponseSchema>;
/** @deprecated Use SessionFollowUpDecision for canonical fields. */
export type FollowUpDecision = z.infer<typeof followUpDecisionSchema>;
/** @deprecated Use SessionFollowUpResponse for canonical fields. */
export type FollowUpResponse = z.infer<typeof followUpResponseSchema>;

export const sessionCreateRequestSchema = createSessionInputSchema
  .omit({ project_id: true, workspace_id: true, original_session_id: true, attachments: true })
  .extend({
    attachments: z.array(z.object({ fileId: z.string().min(1) })).optional(),
    projectId: z.string().min(1),
    workspaceId: z.string().optional(),
    originalSessionId: z.string().optional(),
  });
export type SessionCreateRequest = z.infer<typeof sessionCreateRequestSchema>;

export const sessionAttachmentDetailsSchema = sessionAttachmentSchema
  .omit({ file_id: true, mime_type: true, size_bytes: true, created_at: true, updated_at: true })
  .extend({
    fileId: z.string(),
    mimeType: z.string().nullable(),
    sizeBytes: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  });
export type SessionAttachmentDetails = z.infer<typeof sessionAttachmentDetailsSchema>;
export const sessionFollowUpRequestSchema = followUpInputSchema
  .omit({
    question_response: true,
    summary_from_session_id: true,
    summary_format: true,
    summary_role: true,
    attachments: true,
  })
  .extend({
    questionResponse: questionResponseSchema.optional(),
    summaryFromSessionId: z.string().optional(),
    summaryFormat: z.enum(["brief", "detailed"]).optional(),
    summaryRole: z.enum(["assistant", "all"]).optional(),
    attachments: z.array(z.object({ fileId: z.string().min(1) })).optional(),
  });
export type SessionFollowUpRequest = z.infer<typeof sessionFollowUpRequestSchema>;
export const sessionFollowUpDecisionSchema = z.union([
  z.object({ status: z.literal("dispatched") }),
  z.object({ status: z.literal("queued"), queuePosition: z.number().int() }),
]);
export type SessionFollowUpDecision = z.infer<typeof sessionFollowUpDecisionSchema>;
export const sessionFollowUpResponseSchema = followUpResponseSchema
  .extend(sessionDetailsSchema.shape)
  .extend({ followUp: sessionFollowUpDecisionSchema });
export type SessionFollowUpResponse = z.infer<typeof sessionFollowUpResponseSchema>;
