import { z } from "zod";
import { nativeDocumentSelectionSchema, nativePresenceLimits } from "./native-document-presence";
import { nativeDocumentTargetSchema, nativeTextTargetSchema, textDocumentRefSchema } from "./native-document-schemas";

export const textEditingErrorSchema = z.strictObject({
  code: z.enum([
    "capability_denied",
    "grant_invalid",
    "source_unavailable",
    "source_read_only",
    "source_retired",
    "source_changed",
    "missing_history",
    "recovery_required",
    "invalid_frame",
    "projection_failed",
    "session_closed",
    "draft_active",
  ]),
  message: z.string(),
  retryable: z.boolean(),
});
const id = z.string().min(1);
const handle = { handle: id };
export const textOpenInputSchema = z.union([
  textDocumentRefSchema,
  z.strictObject({ grant: z.strictObject({ token: id }) }),
]);
export const textEditingRequestSchema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("current") }),
  z.strictObject({ operation: z.enum(["register", "abandon"]), memberId: z.uuid() }),
  z.strictObject({
    operation: z.literal("open"),
    memberId: z.uuid(),
    input: textOpenInputSchema,
    sourceState: z.base64().optional(),
    pendingUpdate: z.base64().optional(),
  }),
  z.strictObject({
    operation: z.literal("submit"),
    ...handle,
    sequence: z.number().int().positive(),
    update: z.base64(),
  }),
  z.strictObject({ operation: z.enum(["snapshot", "close"]), ...handle }),
  z.strictObject({ operation: z.literal("project"), ...handle, revision: z.number().int().nonnegative() }),
  z.strictObject({
    operation: z.literal("presence"),
    ...handle,
    selection: nativeDocumentSelectionSchema.refine(
      (selection) => JSON.stringify(selection).length <= nativePresenceLimits.bytes,
    ),
  }),
  z.strictObject({ operation: z.literal("closeReady"), ...handle, barrierId: z.uuid() }),
  z.strictObject({
    operation: z.literal("closeFailed"),
    ...handle,
    barrierId: z.uuid(),
    error: textEditingErrorSchema,
  }),
]);
export const textEditingConnectionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("agent"), target: nativeTextTargetSchema }),
  z
    .strictObject({
      kind: z.literal("placement"),
      viewId: id.optional(),
      target: nativeDocumentTargetSchema.optional(),
    })
    .refine((input) => input.viewId || input.target, "A text placement needs a view or selected file"),
]);
export type TextEditingConnectionInput = z.infer<typeof textEditingConnectionSchema>;
export interface TextEditingConnectionInfo {
  token: string;
}
