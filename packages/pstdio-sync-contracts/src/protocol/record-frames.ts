import { z } from "zod";
import { assetSchema } from "../wire";
import { syncIdSchema } from "./envelopes";

/** Where another device finds an asset's encrypted bytes on the relay. */
export const assetReferenceSchema = z.strictObject({
  asset: assetSchema,
  blobId: syncIdSchema,
  encrypted: assetSchema,
});
export type AssetReference = z.infer<typeof assetReferenceSchema>;

/** The plaintext header of a record frame or latest-state chunk. Clients encrypt the whole frame. */
export const recordFrameHeaderSchema = z.strictObject({
  version: z.literal(1),
  records: z.array(z.strictObject({ recordId: z.string().min(1), byteLength: z.number().int().nonnegative() })),
  assets: z.array(assetReferenceSchema),
  /** A save too large for one update travels as an encrypted blob holding the whole frame. */
  blob: z.strictObject({ blobId: syncIdSchema, byteLength: z.number().int().positive() }).optional(),
});

/** A latest state of a record stream lists its chunks; each chunk is an encrypted blob. */
export const recordStreamStateSchema = z.strictObject({
  version: z.literal(1),
  chunks: z.array(z.strictObject({ blobId: syncIdSchema, byteLength: z.number().int().positive() })),
});
export type RecordStreamState = z.infer<typeof recordStreamStateSchema>;
