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
export const recordFrameHeaderSchema = z
  .strictObject({
    version: z.literal(1),
    format: z.literal("ordered").optional(),
    records: z.array(z.strictObject({ recordId: z.string().min(1), byteLength: z.number().int().nonnegative() })),
    assets: z.array(assetReferenceSchema),
    /** A save too large for one update travels as an encrypted blob holding the whole frame. */
    blob: z.strictObject({ blobId: syncIdSchema, byteLength: z.number().int().positive() }).optional(),
  })
  .refine(
    (frame) => !frame.blob || (!frame.records.length && !frame.assets.length),
    "A blob pointer must be the entire frame",
  );

/** A latest state of a record stream lists its chunks; each chunk is an encrypted blob. */
export const recordStreamStateSchema = z.strictObject({
  version: z.literal(1),
  format: z.literal("ordered").optional(),
  chunks: z.array(z.strictObject({ blobId: syncIdSchema, byteLength: z.number().int().positive() })),
});
export type RecordStreamState = z.infer<typeof recordStreamStateSchema>;

/** Authenticated even when a caught-up device does not need to download checkpoint chunks. */
export const recordStreamSummarySchema = z
  .strictObject({
    format: z.literal("ordered").optional(),
    records: z.number().int().nonnegative(),
    bytes: z.number().int().nonnegative(),
    receiptRoot: z
      .strictObject({ blobId: syncIdSchema, byteLength: z.number().int().positive() })
      .nullable()
      .optional(),
  })
  .refine(
    (summary) => (summary.format === "ordered") === (summary.receiptRoot !== undefined),
    "Ordered summaries require their receipt root",
  );
