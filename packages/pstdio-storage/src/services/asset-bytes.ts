import { createHash } from "node:crypto";
import { link, mkdir, open, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import type { Asset } from "pstdio-sync-contracts";
import { type AssetBytesOwner, assetBytePaths } from "../storage/asset-byte-paths";

const hasCode = (error: unknown, code: string) => (error as NodeJS.ErrnoException).code === code;

export class AssetIntegrityError extends Error {
  constructor() {
    super("Asset integrity mismatch");
    this.name = "AssetIntegrityError";
  }
}

const checkIntegrity = (byteLength: number, sha256: string, expected: Asset) => {
  if (byteLength !== expected.byteLength || sha256 !== expected.sha256) throw new AssetIntegrityError();
};

const verifiedStream = (file: string, expected: Asset, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  const hash = createHash("sha256");
  let byteLength = 0;
  const source = Bun.file(file).stream();
  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        hash.update(chunk);
        byteLength += chunk.byteLength;
        controller.enqueue(chunk);
      },
      flush() {
        checkIntegrity(byteLength, hash.digest("hex"), expected);
      },
    }),
    { signal },
  );
};

const verifyFile = async (file: string, expected: Asset, signal?: AbortSignal) => {
  const reader = verifiedStream(file, expected, signal).getReader();
  try {
    while (!(await reader.read()).done) {
      // Consume verification one chunk at a time without retaining asset bytes.
    }
  } finally {
    reader.releaseLock();
  }
};

/** Local bytes only. The API owns transfer identities, metadata, and retention decisions. */
export const createAssetBytesStorage = (root: string) => {
  const progress = async (owner: AssetBytesOwner, operationId: string) => {
    try {
      return (await stat(assetBytePaths(root, owner).transfer(operationId))).size;
    } catch (error) {
      if (hasCode(error, "ENOENT")) return 0;
      throw error;
    }
  };

  const append = async (
    owner: AssetBytesOwner,
    operationId: string,
    offset: number,
    data: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
  ) => {
    signal?.throwIfAborted();
    const file = assetBytePaths(root, owner).transfer(operationId);
    await mkdir(dirname(file), { recursive: true });
    const handle = await open(file, "a+");
    const reader = data.getReader();
    const abort = () => {
      void reader.cancel(signal?.reason).catch(() => undefined);
    };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      signal?.throwIfAborted();
      const current = await handle.stat();
      if (current.size !== offset) throw new Error("Upload offset does not match stored bytes");
      // A crash can leave the transfer linked to its published immutable version.
      if (current.nlink > 1) throw new Error("Upload bytes are already published");
      let byteLength = offset;
      while (true) {
        signal?.throwIfAborted();
        const chunk = await reader.read();
        signal?.throwIfAborted();
        if (chunk.done) break;
        await handle.writeFile(chunk.value);
        byteLength += chunk.value.byteLength;
      }
      return byteLength;
    } finally {
      signal?.removeEventListener("abort", abort);
      reader.releaseLock();
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
    }
  };

  const publish = async (owner: AssetBytesOwner, operationId: string, asset: Asset, signal?: AbortSignal) => {
    const paths = assetBytePaths(root, owner);
    const transfer = paths.transfer(operationId);
    const version = paths.version(asset.sha256);
    await verifyFile(transfer, asset, signal);
    await mkdir(dirname(version), { recursive: true });
    signal?.throwIfAborted();
    try {
      // link creates a complete version atomically and never replaces an existing one.
      await link(transfer, version);
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
      await verifyFile(version, asset, signal);
    }
    await rm(transfer);
    return asset;
  };

  const openVersion = async (owner: AssetBytesOwner, asset: Asset, signal?: AbortSignal) => {
    const file = assetBytePaths(root, owner).version(asset.sha256);
    const current = await stat(file);
    if (current.size !== asset.byteLength) throw new AssetIntegrityError();
    return verifiedStream(file, asset, signal);
  };

  const verify = async (owner: AssetBytesOwner, asset: Asset, signal?: AbortSignal) => {
    const file = assetBytePaths(root, owner).version(asset.sha256);
    await stat(file);
    await verifyFile(file, asset, signal);
  };

  const removeTransfer = (owner: AssetBytesOwner, operationId: string) =>
    rm(assetBytePaths(root, owner).transfer(operationId), { force: true });

  return { append, progress, publish, open: openVersion, verify, removeTransfer };
};
