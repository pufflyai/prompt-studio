import { z } from "zod";
import { syncIdSchema } from "./envelopes";

export const publishedExtensionsId = "pstdio.published-extensions";

// The host opens these two existing documents under the reserved catalog owner.
// Deriving their addresses from generation one preserves old packages across key rotation.
export const publicationDocumentNames = [
  JSON.stringify([publishedExtensionsId, "owner"]),
  JSON.stringify([publishedExtensionsId, "record-stream-v2"]),
] as const;

export const publicationGrantSchema = z.strictObject({
  documents: z.tuple([syncIdSchema, syncIdSchema]),
  canWrite: z.boolean(),
});
