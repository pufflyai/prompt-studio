import { createHash } from "node:crypto";
import type { AssetOwner, AssetReference } from "pstdio-api-contracts";
import { UnreadableSyncData } from "pstdio-sync/encryption";
import { AssetTransferError, type createAssetTransferService } from "../../../services/asset-transfer-service";

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
    try {
      await assets.receive(owner, operationId, reference, source, signal);
    } catch (error) {
      if (!(error instanceof AssetTransferError) || error.code !== "ASSET_INTEGRITY_MISMATCH") throw error;
      // A short download resumes on the next pass. Every byte arriving wrong cannot be fixed, so sync sets it aside.
      const transfer = await assets.get(owner, operationId, signal);
      if (transfer?.status === "staging" && transfer.uploadedByteLength >= reference.byteLength)
        throw new UnreadableSyncData();
      throw error;
    }
  },
});
