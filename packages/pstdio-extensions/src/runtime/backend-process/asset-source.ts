import type { ExtensionAssetsApi } from "pstdio-api-contracts/extension-kernel";

const CHUNK_BYTES = 64 * 1024;

type StageInput = Parameters<ExtensionAssetsApi["stage"]>[0];

interface AssetReader {
  size: number;
  type: string;
  read(offset: number, end: number): Promise<Uint8Array>;
}

/** Exposes only bounded reads of the selected Blob, even when it is backed by a large file. */
export const exportAssetStageInput = ({ operationId, source }: StageInput, signal: AbortSignal) => {
  if (!(source instanceof Blob)) throw new TypeError("Asset staging requires a Blob.");
  const { size, type } = source;
  const reader: AssetReader = {
    size,
    type,
    async read(offset, end) {
      signal.throwIfAborted();
      if (
        !Number.isSafeInteger(offset) ||
        !Number.isSafeInteger(end) ||
        offset < 0 ||
        end > size ||
        end - offset > CHUNK_BYTES ||
        end <= offset
      )
        throw new RangeError("Invalid asset read range.");
      const bytes = await source.slice(offset, end).arrayBuffer();
      signal.throwIfAborted();
      return new Uint8Array(bytes);
    },
  };
  return { operationId, source: reader };
};

/** The host owns hashing and the resume offset. Pull bytes only after the host authorizes staging. */
export const importAssetStageInput = (value: unknown) => {
  const input = value as { operationId: string; source: AssetReader } | undefined;
  if (!input) throw new TypeError("Missing asset staging input.");
  const source = input.source;
  if (
    !source ||
    !Number.isSafeInteger(source.size) ||
    source.size < 0 ||
    typeof source.type !== "string" ||
    typeof source.read !== "function"
  )
    throw new TypeError("Invalid asset staging source.");
  const { size, type, read } = source;
  const streamFrom = (start: number) => {
    let offset = start;
    let cancelled = false;
    return new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          if (offset === size) {
            controller.close();
            return;
          }
          const end = Math.min(offset + CHUNK_BYTES, size);
          const bytes = await read(offset, end);
          if (cancelled) return;
          if (!(bytes instanceof Uint8Array) || bytes.byteLength !== end - offset)
            throw new Error("Asset source returned an incomplete chunk.");
          offset = end;
          controller.enqueue(bytes);
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
  };
  return {
    operationId: input.operationId,
    source: {
      size,
      type,
      stream: () => streamFrom(0),
      slice: (offset: number) => ({ stream: () => streamFrom(offset) }),
    },
  };
};
