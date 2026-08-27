import { z } from "@hono/zod-openapi";
import {
  approvalInputSchema,
  createSessionInputSchema,
  followUpInputSchema,
  followUpResponseSchema,
  sessionConversationResponseSchema,
  sessionSchema,
} from "pstdio-api-contracts";

export const sessionResponseSchema = sessionSchema;
export { followUpResponseSchema, sessionConversationResponseSchema };

export const createSessionBodySchema = createSessionInputSchema.strict().refine((data) => data.prompt, {
  message: "A prompt is required.",
});

export const followUpBodySchema = followUpInputSchema
  .strict()
  .refine((data) => data.prompt || data.summary_from_session_id, {
    message: "At least one of 'prompt' or 'summary_from_session_id' is required.",
  });

export const approveBodySchema = approvalInputSchema.strict();
export const notFoundResponseSchema = z.object({ error: z.string() });
