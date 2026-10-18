import { z } from "@hono/zod-openapi";
import {
  approvalInputSchema,
  createSessionInputSchema,
  followUpInputSchema,
  sessionConversationResponseSchema,
  sessionCreateRequestSchema,
  sessionDetailsSchema,
  sessionFollowUpRequestSchema,
  sessionFollowUpResponseSchema,
  sessionSchema,
} from "pstdio-api-contracts";

export const sessionResponseSchema = sessionSchema.extend(sessionDetailsSchema.shape);
export { sessionConversationResponseSchema, sessionFollowUpResponseSchema as followUpResponseSchema };

export const createSessionBodySchema = z
  .union([
    createSessionInputSchema.strict(),
    sessionCreateRequestSchema
      .strict()
      .transform(({ projectId, workspaceId, originalSessionId, attachments, ...input }) => ({
        ...input,
        attachments: attachments?.map(({ fileId }) => ({ file_id: fileId })),
        project_id: projectId,
        workspace_id: workspaceId,
        original_session_id: originalSessionId,
      })),
  ])
  .refine((data) => !data.operation || !data.prompt, {
    message: "A prompt and a native operation cannot be combined.",
  })
  .refine((data) => !data.operation || !data.attachments?.length, {
    message: "Native operations do not accept attachments.",
  });

export const followUpBodySchema = z
  .union([
    followUpInputSchema.strict(),
    sessionFollowUpRequestSchema
      .strict()
      .transform(({ questionResponse, summaryFromSessionId, summaryFormat, summaryRole, attachments, ...input }) => ({
        ...input,
        question_response: questionResponse,
        summary_from_session_id: summaryFromSessionId,
        summary_format: summaryFormat,
        summary_role: summaryRole,
        attachments: attachments?.map(({ fileId }) => ({ file_id: fileId })),
      })),
  ])
  .refine((data) => data.prompt || data.summary_from_session_id, {
    message: "At least one of 'prompt' or 'summary_from_session_id' is required.",
  });

export const approveBodySchema = approvalInputSchema.strict();
export const notFoundResponseSchema = z.object({ error: z.string() });
