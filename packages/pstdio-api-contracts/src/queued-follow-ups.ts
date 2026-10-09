import { z } from "zod";
import { harnessParamsInputSchema, sessionAttachmentRefSchema } from "./session-request-values";

export const queuedFollowUpSchema = z.object({
  queuePosition: z.number().int().positive(),
  revision: z.string().min(1),
  prompt: z.string(),
  steeringUnavailableReason: z.string().nullable().optional(),
  steeringDelivery: z.object({ id: z.string(), runStartedAt: z.string() }).nullable(),
  model: z.string().nullable(),
  params: harnessParamsInputSchema,
  attachments: z.array(sessionAttachmentRefSchema),
});

export const updateQueuedFollowUpInputSchema = z.object({
  prompt: z.string().trim().min(1),
  expectedRevision: z.string().min(1).optional(),
  model: z.string().min(1).nullable().optional(),
  params: harnessParamsInputSchema.nullable().optional(),
  attachments: z.array(sessionAttachmentRefSchema).optional(),
});

export const combineQueuedFollowUpsInputSchema = z.object({
  sourcePosition: z.number().int().positive(),
  sourceRevision: z.string().min(1),
  targetRevision: z.string().min(1),
});

export const queuedFollowUpUpdateResponseSchema = z.object({ ok: z.literal(true), request: queuedFollowUpSchema });
export const pendingQueuedFollowUpsResponseSchema = z.object({
  requests: z.array(queuedFollowUpSchema),
  activeRunStartedAt: z.string().nullable(),
  steeringAvailable: z.boolean(),
  steeringUnavailableReason: z.string().nullable(),
});
export type QueuedFollowUpRequest = z.infer<typeof queuedFollowUpSchema>;
export type UpdateQueuedFollowUpInput = z.infer<typeof updateQueuedFollowUpInputSchema>;
export type CombineQueuedFollowUpsInput = z.infer<typeof combineQueuedFollowUpsInputSchema>;
export type QueuedFollowUpUpdateResponse = z.infer<typeof queuedFollowUpUpdateResponseSchema>;
export type PendingQueuedFollowUpsResponse = z.infer<typeof pendingQueuedFollowUpsResponseSchema>;

export const steerQueuedFollowUpInputSchema = z.object({
  expectedRevision: z.string().min(1),
  expectedRunStartedAt: z.string().min(1),
});
export const queuedSteeringResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("accepted"), deliveryId: z.string() }),
  z.object({
    status: z.literal("rejected"),
    reason: z.enum([
      "unsupported",
      "inactive",
      "stale_run",
      "blocking_input",
      "missing",
      "stale_revision",
      "different_settings",
      "delivery_failed",
      "invalid_attachments",
    ]),
    message: z.string(),
  }),
  z.object({ status: z.literal("uncertain"), deliveryId: z.string(), message: z.string() }),
]);
export type SteerQueuedFollowUpInput = z.infer<typeof steerQueuedFollowUpInputSchema>;
export type QueuedSteeringResult = z.infer<typeof queuedSteeringResultSchema>;
