import { z } from "zod";
import { fingerprintSchema, identitySchema } from "./wire";

export const managedPackageMaxBytes = 64 * 1024 * 1024;
export const managedExtensionIdentity = z
  .string()
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/)
  .refine((id) => id !== "pstdio.published-extensions");
const metadata = z.strictObject({
  extensionId: managedExtensionIdentity,
  name: z.string().min(1).max(160),
  version: z.string().min(1).max(100),
  revision: fingerprintSchema,
});
export const managedExtensionSchema = metadata.extend({ selectionId: identitySchema });
export type ManagedExtension = z.infer<typeof managedExtensionSchema>;

// These native-to-manager descriptors never cross an extension webview or command bridge.
export const managedPackageDescriptorSchema = metadata.extend({
  secret: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  blobId: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  cipherSha256: fingerprintSchema,
  byteLength: z.number().int().min(33).max(managedPackageMaxBytes),
});
export const managedPackageUploadSchema = managedPackageDescriptorSchema.extend({
  expectedSelection: identitySchema.nullable(),
});
export const managedExtensionRemovalSchema = z.strictObject({ expectedSelection: identitySchema });
export const teamExtensionPolicySchema = z.strictObject({
  extensionId: managedExtensionIdentity,
  selectionId: identitySchema,
  required: managedExtensionSchema.nullable(),
});
export type ManagedPackageDescriptor = z.infer<typeof managedPackageDescriptorSchema>;
export type ManagedPackageUpload = z.infer<typeof managedPackageUploadSchema>;
export type TeamExtensionPolicy = z.infer<typeof teamExtensionPolicySchema>;
