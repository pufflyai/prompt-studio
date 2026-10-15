import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { AssetReference, AssetTransfer } from "pstdio-api-contracts";
import { PstdioApiError, PstdioConnectionError, type RequestFn } from "./request";

export interface AssetClientOwner {
  projectId: string;
  extensionInstanceId: string;
}
export interface AssetUploadInput extends AssetClientOwner {
  /** Persist this identity with pending work to resume the same upload after restart. */
  operationId: string;
  source: Blob;
  signal?: AbortSignal;
  onProgress?: (uploadedByteLength: number) => void;
}
interface AssetOperationInput extends AssetClientOwner {
  operationId: string;
  signal?: AbortSignal;
}
interface AssetReadInput extends AssetClientOwner {
  asset: AssetReference;
  signal?: AbortSignal;
}

const ownerPath = (owner: AssetClientOwner) =>
  `/v1/projects/${encodeURIComponent(owner.projectId)}/extensions/${encodeURIComponent(owner.extensionInstanceId)}`;
const operationPath = (input: AssetOperationInput) =>
  `${ownerPath(input)}/asset-transfers/${encodeURIComponent(input.operationId)}`;
const hashSource = async (source: Blob, signal?: AbortSignal) => {
  const hash = sha256.create();
  const reader = source.stream().getReader();
  const abort = () => {
    void reader.cancel(signal?.reason).catch(() => undefined);
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      hash.update(value);
    }
    return bytesToHex(hash.digest());
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
};

const retryable = (error: unknown) =>
  error instanceof PstdioConnectionError ||
  (error instanceof PstdioApiError && (error.status >= 500 || error.code === "ASSET_OFFSET_MISMATCH"));

export const createAssetsClient = (request: RequestFn) => {
  const begin = (input: AssetOperationInput & { expected: AssetReference }) =>
    request<AssetTransfer>(operationPath(input), {
      method: "PUT",
      body: { expected: input.expected },
      signal: input.signal,
    });
  const get = (input: AssetOperationInput) => request<AssetTransfer>(operationPath(input), { signal: input.signal });
  const cancel = (input: AssetOperationInput) =>
    request<AssetTransfer>(operationPath(input), { method: "DELETE", signal: input.signal });
  const uploadAttempt = async (input: AssetUploadInput, expected: AssetReference) => {
    let transfer = await begin({ ...input, expected });
    if (transfer.status === "cancelled")
      throw new PstdioApiError("Asset transfer cancelled", 409, "ASSET_TRANSFER_CANCELLED");
    while (transfer.status === "staging" && transfer.uploadedByteLength < expected.byteLength) {
      const offset = transfer.uploadedByteLength;
      const body = await input.source.slice(offset, offset + 8 * 1024 * 1024).arrayBuffer();
      transfer = await request<AssetTransfer>(`${operationPath(input)}/content?offset=${offset}`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body,
        signal: input.signal,
      });
      if (transfer.status === "staging") input.onProgress?.(transfer.uploadedByteLength);
    }
    transfer = await request<AssetTransfer>(`${operationPath(input)}/complete`, {
      method: "POST",
      signal: input.signal,
    });
    if (transfer.status !== "complete") throw new Error("Asset upload did not complete");
    input.onProgress?.(transfer.asset.byteLength);
    return transfer.asset;
  };
  const upload = async (input: AssetUploadInput) => {
    const expected = {
      sha256: await hashSource(input.source, input.signal),
      byteLength: input.source.size,
      mediaType: input.source.type || "application/octet-stream",
    };
    for (let attempt = 0; ; attempt++) {
      input.signal?.throwIfAborted();
      try {
        return await uploadAttempt(input, expected);
      } catch (error) {
        input.signal?.throwIfAborted();
        if (attempt >= 2 || !retryable(error)) throw error;
        // Lost acknowledgements resume from the server's persisted offset on the next begin.
      }
    }
  };
  const read = async (input: AssetReadInput) => {
    const { asset } = input;
    const query = new URLSearchParams({ byteLength: String(asset.byteLength), mediaType: asset.mediaType });
    const stream = await request<ReadableStream<Uint8Array>>(
      `${ownerPath(input)}/assets/${encodeURIComponent(asset.sha256)}/content?${query}`,
      {
        signal: input.signal,
        response: "stream",
      },
    );
    const hash = sha256.create();
    let size = 0;
    return stream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          hash.update(chunk);
          size += chunk.byteLength;
          controller.enqueue(chunk);
        },
        flush() {
          if (size !== asset.byteLength || bytesToHex(hash.digest()) !== asset.sha256)
            throw new Error("Asset integrity mismatch");
        },
      }),
      { signal: input.signal },
    );
  };
  return { begin, get, cancel, upload, read };
};
export type AssetsClient = ReturnType<typeof createAssetsClient>;
