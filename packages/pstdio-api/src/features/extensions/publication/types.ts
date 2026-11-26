import { identitySchema, publishedExtensionsId } from "pstdio-sync-contracts";
import { z } from "zod";

export { publishedExtensionsId };
export const packageMetadataSchema = z.strictObject({
  extensionId: identitySchema.refine((id) => id !== publishedExtensionsId),
  version: z.string(),
});
export const selectionSchema = z.strictObject({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  enabled: z.boolean(),
  teamPolicyRevision: identitySchema.optional(),
});
export const publicationSchema = packageMetadataSchema.extend(selectionSchema.shape);
export const publicationRemovalSchema = z.strictObject({
  teamPolicyRevision: identitySchema,
  removed: z.literal(true),
});
export type Publication = z.infer<typeof publicationSchema>;

export class PublicationAccessDenied extends Error {
  constructor() {
    super("Project access is required to change published extensions. Verify your Cloud access and try again.");
  }
}

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
