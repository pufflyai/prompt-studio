import { scopeSchema, syncIdSchema } from "pstdio-sync-contracts";
import { z } from "zod";

// Each encrypted sync blob is its own owner, so equal ciphertext does not share a verified
// mapping that removing one blob would break. Scope addresses remain useful to internal asset fixtures.
export const assetOwnerSchema = z.union([
  scopeSchema,
  z.strictObject({ projectKey: z.string().min(1), blobId: syncIdSchema }),
]);
export type AssetOwner = z.infer<typeof assetOwnerSchema>;
