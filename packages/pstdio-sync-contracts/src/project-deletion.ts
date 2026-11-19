import { z } from "zod";
import { identitySchema } from "./wire";

export const projectDeletionServicePath = "/internal/v1/project-deletions";

const projectDeletionIdentitySchema = z.strictObject({
  accountId: identitySchema,
  workbenchId: identitySchema,
  operationId: identitySchema,
});
export const projectDeletionJobSchema = projectDeletionIdentitySchema.extend({ delivery: z.int().positive() });
export const projectDeletionJobsSchema = z.array(projectDeletionJobSchema);
export type ProjectDeletionJob = z.infer<typeof projectDeletionJobSchema>;

// Only the trusted relay can attest that its durable barrier is in place and all owned content is gone.
export const projectDeletionAcknowledgementSchema = z.discriminatedUnion("result", [
  projectDeletionJobSchema.extend({ result: z.literal("needs-attention") }),
  projectDeletionIdentitySchema.extend({ result: z.literal("purged"), writeBarrier: z.literal(true) }),
]);
export type ProjectDeletionAcknowledgement = z.infer<typeof projectDeletionAcknowledgementSchema>;

export const startProjectDeletionSchema = z.strictObject({ confirm: z.literal(true) });

export const projectDeletionStatusSchema = projectDeletionIdentitySchema.omit({ accountId: true }).extend({
  startedAt: z.iso.datetime(),
  state: z.enum(["deleting", "needs-attention", "completed"]),
  completedAt: z.iso.datetime().nullable(),
});
export type ProjectDeletionStatus = z.infer<typeof projectDeletionStatusSchema>;
