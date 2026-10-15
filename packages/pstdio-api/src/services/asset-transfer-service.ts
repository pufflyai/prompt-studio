import { createHash } from "node:crypto";
import { type AssetOwner, type AssetReference, assetOwnerSchema, assetReferenceSchema } from "pstdio-api-contracts";
import type { createAssetTransfersDBService } from "pstdio-db";
import { AssetIntegrityError, type createAssetBytesStorage } from "pstdio-storage";
import { AssetTransferError } from "./asset-transfer-errors";
import { createAssetTransferOperations } from "./asset-transfer-operations";

export { AssetTransferError } from "./asset-transfer-errors";

interface AssetTransferServiceDeps {
  transfers: ReturnType<typeof createAssetTransfersDBService>;
  bytes: ReturnType<typeof createAssetBytesStorage>;
}

const sameReference = (first: AssetReference, second: AssetReference) =>
  first.sha256 === second.sha256 && first.byteLength === second.byteLength && first.mediaType === second.mediaType;

export const createAssetTransferService = (deps: AssetTransferServiceDeps) => {
  const operations = createAssetTransferOperations();
  const get = async (owner: AssetOwner, operationId: string, signal?: AbortSignal) => {
    assetOwnerSchema.parse(owner);
    const record = await deps.transfers.get(owner, operationId);
    if (!record) return null;
    if (record.cancelled_at) {
      await deps.bytes.removeTransfer(owner, operationId);
      return { status: "cancelled" as const, operationId, expected: record.expected };
    }
    try {
      await deps.bytes.verify(owner, record.expected, signal);
      return { status: "complete" as const, operationId, asset: record.expected };
    } catch (error) {
      if (error instanceof AssetIntegrityError)
        throw new AssetTransferError("ASSET_INTEGRITY_MISMATCH", { cause: error });
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return {
      status: "staging" as const,
      operationId,
      expected: record.expected,
      uploadedByteLength: await deps.bytes.progress(owner, operationId),
    };
  };
  const requireTransfer = async (owner: AssetOwner, operationId: string, signal?: AbortSignal) => {
    const transfer = await get(owner, operationId, signal);
    if (!transfer) throw new AssetTransferError("ASSET_TRANSFER_NOT_FOUND");
    if (transfer.status === "cancelled") throw new AssetTransferError("ASSET_TRANSFER_CANCELLED");
    return transfer;
  };
  const begin = async (owner: AssetOwner, operationId: string, expected: AssetReference) => {
    assetOwnerSchema.parse(owner);
    assetReferenceSchema.parse(expected);
    const record = await deps.transfers.begin(owner, operationId, expected);
    if (!sameReference(record.expected, expected)) throw new AssetTransferError("ASSET_OPERATION_CONFLICT");
    return (await get(owner, operationId))!;
  };
  const append = (
    owner: AssetOwner,
    operationId: string,
    offset: number,
    data: ReadableStream<Uint8Array>,
    requestSignal?: AbortSignal,
  ) =>
    operations.run(
      owner,
      operationId,
      async (signal) => {
        const transfer = await requireTransfer(owner, operationId, signal);
        if (transfer.status === "complete") return transfer;
        if (transfer.uploadedByteLength !== offset) throw new AssetTransferError("ASSET_OFFSET_MISMATCH");
        await deps.bytes.append(owner, operationId, offset, data, signal);
        return (await get(owner, operationId, signal))!;
      },
      requestSignal,
    );
  const complete = (owner: AssetOwner, operationId: string, requestSignal?: AbortSignal) =>
    operations.run(
      owner,
      operationId,
      async (signal) => {
        const transfer = await requireTransfer(owner, operationId, signal);
        if (transfer.status === "complete") {
          await deps.bytes.removeTransfer(owner, operationId);
          return transfer;
        }
        try {
          await deps.bytes.publish(owner, operationId, transfer.expected, signal);
        } catch (error) {
          if (error instanceof AssetIntegrityError)
            throw new AssetTransferError("ASSET_INTEGRITY_MISMATCH", { cause: error });
          throw error;
        }
        return { status: "complete" as const, operationId, asset: transfer.expected };
      },
      requestSignal,
    );
  const cancel = (owner: AssetOwner, operationId: string) =>
    operations.interrupt(owner, operationId, async () => {
      const transfer = await get(owner, operationId);
      if (!transfer || transfer.status === "cancelled") return transfer;
      if (transfer.status === "complete") {
        await deps.bytes.removeTransfer(owner, operationId);
        return transfer;
      }
      await deps.transfers.cancel(owner, operationId);
      await deps.bytes.removeTransfer(owner, operationId);
      return { status: "cancelled" as const, operationId, expected: transfer.expected };
    });
  const read = (owner: AssetOwner, asset: AssetReference, signal?: AbortSignal) => {
    assetOwnerSchema.parse(owner);
    assetReferenceSchema.parse(asset);
    return deps.bytes.open(owner, asset, signal);
  };
  const verifyComplete = async (owner: AssetOwner, assets: AssetReference[], signal?: AbortSignal) => {
    assetOwnerSchema.parse(owner);
    for (const asset of assets) await deps.bytes.verify(owner, assetReferenceSchema.parse(asset), signal);
  };
  const stage = async (owner: AssetOwner, operationId: string, source: Blob, signal?: AbortSignal) => {
    const hash = createHash("sha256");
    const reader = source.stream().getReader();
    const abort = () => {
      void reader.cancel(signal?.reason).catch(() => undefined);
    };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      while (true) {
        signal?.throwIfAborted();
        const chunk = await reader.read();
        signal?.throwIfAborted();
        if (chunk.done) break;
        hash.update(chunk.value);
      }
    } finally {
      signal?.removeEventListener("abort", abort);
      reader.releaseLock();
    }
    const expected = {
      sha256: hash.digest("hex"),
      byteLength: source.size,
      mediaType: source.type || "application/octet-stream",
    };
    const transfer = await begin(owner, operationId, expected);
    if (transfer.status === "cancelled") throw new AssetTransferError("ASSET_TRANSFER_CANCELLED");
    if (transfer.status === "staging")
      await append(
        owner,
        operationId,
        transfer.uploadedByteLength,
        source.slice(transfer.uploadedByteLength).stream(),
        signal,
      );
    const completed = await complete(owner, operationId, signal);
    return completed.asset;
  };
  return { begin, get, append, complete, cancel, read, verifyComplete, stage };
};
