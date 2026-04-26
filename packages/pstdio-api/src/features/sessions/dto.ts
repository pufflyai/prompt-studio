import { z } from "@hono/zod-openapi";
import {
  approvalInputSchema,
  createSessionInputSchema,
  followUpInputSchema,
  sessionConversationResponseSchema,
  sessionPromptAttachmentSchema,
  sessionSchema,
} from "pstdio-api-contracts";

export const sessionResponseSchema = sessionSchema;
export { sessionConversationResponseSchema };

export const createSessionBodySchema = createSessionInputSchema
  .strict()
  .refine((data) => data.prompt || data.template, {
    message: "At least one of 'prompt' or 'template' is required.",
  })
  .refine((data) => !(data.prompt && data.template), {
    message: "--prompt and --template are mutually exclusive",
  });

export const followUpBodySchema = followUpInputSchema
  .strict()
  .refine((data) => data.prompt || data.template || data.summary_from_session_id, {
    message: "At least one of 'prompt', 'template', or 'summary_from_session_id' is required.",
  })
  .refine((data) => !(data.prompt && data.template), {
    message: "--prompt and --template are mutually exclusive",
  });

export const approveBodySchema = approvalInputSchema.strict();
export const notFoundResponseSchema = z.object({ error: z.string() });

export const uploadSessionAttachmentBodySchema = z
  .object({
    project_id: z.string().min(1),
    file_name: z.string().min(1),
    content_base64: z.string().min(1),
    mime_type: z.string().min(1),
  })
  .strict();

export const sessionPromptAttachmentResponseSchema = sessionPromptAttachmentSchema;
