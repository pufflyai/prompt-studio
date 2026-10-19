import { scopeSchema } from "pstdio-sync-contracts";
import { syncIdSchema } from "pstdio-sync-contracts/protocol";
import { z } from "zod";

// Grouped storage owns assets per extension scope. Each encrypted sync blob is its own owner, so two
// blobs with equal ciphertext never share a verified mapping that removing one of them would break.
export const assetOwnerSchema = z.union([
  scopeSchema,
  z.strictObject({ projectKey: z.string().min(1), blobId: syncIdSchema }),
]);
export type AssetOwner = z.infer<typeof assetOwnerSchema>;
