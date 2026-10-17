import { z } from "zod";
import { dictionarySchema } from "./json";
import {
  assetSchema,
  fingerprintSchema,
  identitySchema,
  jsonSchema,
  mutationSchema,
  revisionSchema,
  scopeSchema,
} from "./wire";

export const checkpointSchema = z.strictObject({ epoch: identitySchema, sequence: revisionSchema });
export const recordSchema = z.strictObject({
  recordId: identitySchema,
  revision: revisionSchema,
  deleted: z.boolean(),
  primitive: z.enum(["text", "list", "map"]).nullable(),
  shared: z.strictObject({ kind: z.enum(["text", "list"]), update: z.string() }).optional(),
  map: dictionarySchema(jsonSchema),
  value: jsonSchema,
  asset: assetSchema.nullable(),
});
export const conflictSchema = z.strictObject({
  conflictId: identitySchema,
  revision: revisionSchema,
  recordIds: z.array(identitySchema).min(1),
  alternativeOperationIds: z.array(identitySchema).min(1),
  resolvedBy: identitySchema.optional(),
});
export const receiptSchema = z
  .strictObject({
    order: revisionSchema,
    operationId: identitySchema,
    fingerprint: fingerprintSchema,
    mutation: mutationSchema,
    status: z.enum(["accepted", "conflict", "pending"]),
    reason: z.string().optional(),
    checkpoint: checkpointSchema.nullable(),
    conflictId: identitySchema.optional(),
    recoveryProof: fingerprintSchema.optional(),
  })
  .superRefine((receipt, ctx) => {
    const identityMatches =
      receipt.operationId === receipt.mutation.operationId && receipt.fingerprint === receipt.mutation.fingerprint;
    const accepted = receipt.status === "accepted";
    if (
      !identityMatches ||
      accepted !== (receipt.checkpoint !== null) ||
      (receipt.status === "conflict" && !receipt.conflictId)
    ) {
      ctx.addIssue({ code: "custom", message: "Receipt identity, fingerprint, outcome and checkpoint must agree" });
    }
  });
export const snapshotSchema = z.strictObject({
  protocolVersion: z.literal(1),
  scope: scopeSchema,
  journalSequence: revisionSchema,
  checkpoint: checkpointSchema,
  records: dictionarySchema(recordSchema),
  receipts: dictionarySchema(receiptSchema),
  conflicts: dictionarySchema(conflictSchema),
  publishedRevision: identitySchema,
});
export const syncOutcomeSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("saved-locally"), operationId: identitySchema }),
  z.strictObject({ status: z.literal("pending"), operationId: identitySchema, reason: z.string() }),
  z.strictObject({ status: z.literal("synchronized"), operationId: identitySchema, checkpoint: checkpointSchema }),
  z.strictObject({
    status: z.literal("conflict"),
    operationId: identitySchema,
    conflictId: identitySchema,
    conflictRevision: revisionSchema,
  }),
]);
export type StoredRecord = z.infer<typeof recordSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Checkpoint = z.infer<typeof checkpointSchema>;
export type SyncOutcome = z.infer<typeof syncOutcomeSchema>;

export function replayBoundary(after: Checkpoint, current: Checkpoint, retainedFrom: number) {
  if (
    !checkpointSchema.safeParse(after).success ||
    after.epoch !== current.epoch ||
    after.sequence < retainedFrom ||
    after.sequence > current.sequence
  ) {
    return { status: "snapshot-required" as const, checkpoint: current };
  }
  return { status: "replay" as const, after, through: current };
}
