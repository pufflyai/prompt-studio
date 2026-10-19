import { z } from "zod";
import type { StoredRecord } from "./state";
import { identitySchema } from "./wire";

export const publishedExtensionsId = "pstdio.published-extensions";
export const publicationSchema = z.strictObject({
  extensionId: identitySchema.refine((id) => id !== publishedExtensionsId),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  automation: z.boolean(),
  enabled: z.boolean(),
});
export type Publication = z.infer<typeof publicationSchema>;

export const validatePublicationRecord = (record: StoredRecord) => {
  if (record.deleted) return;
  const publication = publicationSchema.parse(record.value);
  if (record.recordId !== publication.extensionId || record.asset?.sha256 !== publication.revision || record.primitive)
    throw new Error("Published extension identity, revision and package must agree");
  return publication;
};
