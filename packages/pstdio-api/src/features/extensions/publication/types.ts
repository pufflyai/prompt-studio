import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";

export const publishedExtensionsId = "pstdio.published-extensions";
export const packageMetadataSchema = z.strictObject({
  extensionId: identitySchema.refine((id) => id !== publishedExtensionsId),
  version: z.string(),
});
export const selectionSchema = z.strictObject({ revision: z.string().regex(/^[a-f0-9]{64}$/), enabled: z.boolean() });
export const publicationSchema = packageMetadataSchema.extend(selectionSchema.shape);
export type Publication = z.infer<typeof publicationSchema>;

export class PublicationUpdateRequiredError extends Error {
  constructor() {
    super("Update this extension before changing its shared data");
  }
}

/** Another change reached the extension set after the caller read it. */
export class PublicationChangedError extends Error {
  constructor() {
    super("Published extension changed; read its revision again");
  }
}
