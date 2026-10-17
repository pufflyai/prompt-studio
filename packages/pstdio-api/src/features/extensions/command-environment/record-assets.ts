import { createHash } from "node:crypto";
import type { AssetOwner, AssetReference } from "pstdio-api-contracts";
import type { createAssetTransferService } from "../../../services/asset-transfer-service";

export const createRecordAssets = (
  assets: ReturnType<typeof createAssetTransferService>,
  owner: AssetOwner,
  signal?: AbortSignal,
) => ({
  verifyComplete: (references: AssetReference[]) => assets.verifyComplete(owner, references, signal),
  read: (reference: AssetReference) => assets.read(owner, reference, signal),
  receive: async (
    reference: AssetReference,
    source: (offset: number, signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>,
  ) => {
    const identity = JSON.stringify([reference.sha256, reference.byteLength, reference.mediaType]);
    const operationId = `sync-receive:${createHash("sha256").update(identity).digest("hex")}`;
    await assets.receive(owner, operationId, reference, source, signal);
  },
});
