import { z } from "zod";
import { blobReferenceFanout } from "./blob-references";
import { blobBeginSchema, syncIdSchema } from "./envelopes";
import { syncProtocolVersion } from "./routes";

export const syncBlobReferencesFeature = "blob-references-v1";
export const syncCapabilitiesSchema = z.strictObject({
  protocolVersion: z.literal(syncProtocolVersion),
  features: z.array(z.string().min(1)),
});

export const blobManifestBeginSchema = blobBeginSchema.extend({
  children: z
    .array(syncIdSchema)
    .max(blobReferenceFanout)
    .refine((ids) => new Set(ids).size === ids.length, "Child blob IDs must be unique"),
});
