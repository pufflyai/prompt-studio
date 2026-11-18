import { createHash } from "node:crypto";
import { link, mkdir, open, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import type { Asset } from "pstdio-sync-contracts";
import { type AssetBytesOwner, assetBytePaths } from "../storage/asset-byte-paths";

const hasCode = (error: unknown, code: string) => (error as NodeJS.ErrnoException).code === code;

const locateBytes = async (file: string, previousFile?: string) => {
  try {
    return { file, stats: await stat(file) };
  } catch (error) {
    if (!previousFile || !hasCode(error, "ENOENT")) throw error;
    return { file: previousFile, stats: await stat(previousFile) };
  }
};

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
export const createAssetBytesStorage = (root: string, historicalExtensionId?: (id: string) => string) => {
  const historicalPaths = (owner: AssetBytesOwner) => {
    const extensionId = historicalExtensionId?.(owner.extensionId);
    if (extensionId && extensionId !== owner.extensionId) return assetBytePaths(root, { ...owner, extensionId });
  };

  const transferPath = async (owner: AssetBytesOwner, operationId: string) => {
    const file = assetBytePaths(root, owner).transfer(operationId);
    const previous = historicalPaths(owner)?.transfer(operationId);
    if (!previous) return file;
    try {
      return (await locateBytes(file, previous)).file;
    } catch (error) {
      if (hasCode(error, "ENOENT")) return file;
      throw error;
    }
  };

  const locateVersion = (owner: AssetBytesOwner, sha256: string) =>
    locateBytes(assetBytePaths(root, owner).version(sha256), historicalPaths(owner)?.version(sha256));

  const progress = async (owner: AssetBytesOwner, operationId: string) => {
    try {
      const file = assetBytePaths(root, owner).transfer(operationId);
      const previous = historicalPaths(owner)?.transfer(operationId);
      return (await locateBytes(file, previous)).stats.size;
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
    const file = await transferPath(owner, operationId);
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
    const transfer = await transferPath(owner, operationId);
    const version = assetBytePaths(root, owner).version(asset.sha256);
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
    const { file, stats } = await locateVersion(owner, asset.sha256);
    if (stats.size !== asset.byteLength) throw new AssetIntegrityError();
    return verifiedStream(file, asset, signal);
  };

  const verify = async (owner: AssetBytesOwner, asset: Asset, signal?: AbortSignal) => {
    const { file } = await locateVersion(owner, asset.sha256);
    await verifyFile(file, asset, signal);
  };

  const removeTransfer = async (owner: AssetBytesOwner, operationId: string) => {
    await rm(assetBytePaths(root, owner).transfer(operationId), { force: true });
    const previous = historicalPaths(owner)?.transfer(operationId);
    if (previous) await rm(previous, { force: true });
  };

  return { append, progress, publish, open: openVersion, verify, removeTransfer };
};
