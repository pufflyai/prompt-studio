import { z } from "zod";
import { fingerprintSchema, identitySchema } from "../wire";

// Clients create document, blob, update and state IDs at random. The shape keeps them opaque path
// segments; it cannot prove randomness, so clients must never derive them from names.
export const syncIdSchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
export const sequenceSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const byteLengthSchema = sequenceSchema;
// Every payload is ciphertext. The relay stores and forwards it without reading it.
export const payloadSchema = z.base64();
const blobIdsSchema = z
  .array(syncIdSchema)
  .refine((ids) => new Set(ids).size === ids.length, "Blob IDs must be unique");
const spaceOwnerSchema = identitySchema.nullable();

export const updateEnvelopeSchema = z.strictObject({
  updateId: syncIdSchema,
  payload: payloadSchema,
  blobIds: blobIdsSchema,
});
export const updateResultSchema = z.strictObject({ sequence: sequenceSchema.min(1), duplicate: z.boolean() });

export const stateEnvelopeSchema = z.strictObject({
  stateId: syncIdSchema,
  baseStateId: syncIdSchema.nullable(),
  through: sequenceSchema,
  payload: payloadSchema,
  summary: payloadSchema,
  blobIds: blobIdsSchema,
});
export const stateInfoSchema = z.strictObject({
  stateId: syncIdSchema,
  baseStateId: syncIdSchema.nullable(),
  through: sequenceSchema,
  byteLength: byteLengthSchema,
  summary: payloadSchema,
  deviceId: identitySchema,
  createdAt: z.iso.datetime(),
});
export const stateResultSchema = z.strictObject({ state: stateInfoSchema });

export const storedUpdateSchema = z.strictObject({
  sequence: sequenceSchema.min(1),
  updateId: syncIdSchema,
  deviceId: identitySchema,
  payload: payloadSchema,
  createdAt: z.iso.datetime(),
});
export const readRequestSchema = z.strictObject({ after: sequenceSchema });
export const readResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("updates"),
    state: stateInfoSchema.nullable(),
    lastSequence: sequenceSchema,
    updates: z.array(storedUpdateSchema),
    more: z.boolean(),
  }),
  // The updates after the requested sequence were removed. The client downloads the latest state.
  z.strictObject({
    status: z.literal("state-required"),
    state: stateInfoSchema.nullable(),
    lastSequence: sequenceSchema,
  }),
]);

export const blobBeginSchema = z.strictObject({ sha256: fingerprintSchema, byteLength: byteLengthSchema });
export const blobStatusSchema = z.strictObject({
  partSize: z.number().int().positive(),
  completed: z.boolean(),
  parts: z.array(
    z.strictObject({ number: z.number().int().positive(), sha256: fingerprintSchema, byteLength: byteLengthSchema }),
  ),
});
export const blobReadSchema = z.strictObject({ offset: byteLengthSchema });

export const liveClientMessageSchema = z.strictObject({
  type: z.literal("live"),
  spaceOwner: spaceOwnerSchema,
  payload: payloadSchema,
});
export const liveServerMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ready"), protocolVersion: z.number().int().positive() }),
  z.strictObject({
    type: z.literal("live"),
    spaceOwner: spaceOwnerSchema,
    deviceId: identitySchema,
    payload: payloadSchema,
  }),
  z.strictObject({
    type: z.literal("changed"),
    spaceOwner: spaceOwnerSchema,
    documentId: syncIdSchema,
    lastSequence: sequenceSchema,
    stateId: syncIdSchema.nullable(),
  }),
]);

export const syncErrorSchema = z.discriminatedUnion("error", [
  z.strictObject({
    error: z.literal("protocol-unsupported"),
    supported: z.array(z.number().int()),
    message: z.string(),
  }),
  z.strictObject({ error: z.literal("stale-state"), state: stateInfoSchema.nullable() }),
  z.strictObject({ error: z.literal("missing-blobs"), blobIds: z.array(syncIdSchema) }),
  z.strictObject({
    error: z.enum([
      "invalid-request",
      "unauthorized",
      "forbidden",
      "not-found",
      "method-not-allowed",
      "too-large",
      "quota-exceeded",
      "rate-limited",
      "unavailable",
    ]),
  }),
]);

export type UpdateEnvelope = z.infer<typeof updateEnvelopeSchema>;
export type UpdateResult = z.infer<typeof updateResultSchema>;
export type StateEnvelope = z.infer<typeof stateEnvelopeSchema>;
export type StateInfo = z.infer<typeof stateInfoSchema>;
export type StoredUpdate = z.infer<typeof storedUpdateSchema>;
export type ReadResult = z.infer<typeof readResultSchema>;
export type BlobBegin = z.infer<typeof blobBeginSchema>;
export type BlobStatus = z.infer<typeof blobStatusSchema>;
export type LiveClientMessage = z.infer<typeof liveClientMessageSchema>;
export type LiveServerMessage = z.infer<typeof liveServerMessageSchema>;
export type SyncError = z.infer<typeof syncErrorSchema>;
