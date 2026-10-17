import { assetSchema, identitySchema, revisionSchema } from "pstdio-sync-contracts";
import { z } from "zod";

export const assetReferenceSchema = assetSchema;
export type AssetReference = z.infer<typeof assetReferenceSchema>;
export const assetOwnerSchema = z.strictObject({ workbenchId: identitySchema, extensionId: identitySchema });
export type AssetOwner = z.infer<typeof assetOwnerSchema>;

export const assetTransferSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("staging"),
    operationId: identitySchema,
    expected: assetReferenceSchema,
    uploadedByteLength: revisionSchema,
  }),
  z.strictObject({ status: z.literal("complete"), operationId: identitySchema, asset: assetReferenceSchema }),
  z.strictObject({ status: z.literal("cancelled"), operationId: identitySchema, expected: assetReferenceSchema }),
]);
export type AssetTransfer = z.infer<typeof assetTransferSchema>;
