import { z } from "zod";

export type { Json } from "./json";
export { jsonSchema } from "./json";

export const identitySchema = z.string().min(1);
export const revisionSchema = z.number().int().nonnegative();
export const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const scopeSchema = z.strictObject({
  accountId: identitySchema,
  workbenchId: identitySchema,
  extensionId: identitySchema,
});
export const assetSchema = z.strictObject({
  sha256: fingerprintSchema,
  byteLength: revisionSchema,
  mediaType: identitySchema,
});
export type Scope = z.infer<typeof scopeSchema>;
export type Asset = z.infer<typeof assetSchema>;
