import { createHash } from "node:crypto";
import fs from "node:fs";
import { open, rm } from "node:fs/promises";
import path from "node:path";
import { ensureProjectStorageRoot, resolveFileStoragePath } from "../storage/paths";
import { readableFileDirectory } from "../storage/readable-file";

export const createFilesStorageService = (storageRoot: string) => {
  const writeFileAtPath = (storagePath: string, data: Buffer) => {
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
    fs.writeFileSync(storagePath, data);
  };
  const writeFile = (projectId: string, fileId: string, data: Buffer) => {
    ensureProjectStorageRoot(storageRoot, projectId);
    const storagePath = resolveFileStoragePath(storageRoot, projectId, fileId);
    writeFileAtPath(storagePath, data);
    return storagePath;
  };

  const deleteFile = (storagePath: string) => {
    fs.rmSync(readableFileDirectory(storagePath), { recursive: true, force: true });
    if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
  };

  const computeHash = (data: Buffer) => createHash("sha256").update(data).digest("hex");

  const writeStream = async (
    projectId: string,
    fileId: string,
    data: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
  ) => {
    signal?.throwIfAborted();
    ensureProjectStorageRoot(storageRoot, projectId);
    const storagePath = resolveFileStoragePath(storageRoot, projectId, fileId);
    const handle = await open(storagePath, "wx");
    const reader = data.getReader();
    const hash = createHash("sha256");
    let byteLength = 0;
    const abort = () => {
      void reader.cancel(signal?.reason).catch(() => undefined);
    };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      try {
        while (true) {
          signal?.throwIfAborted();
          const chunk = await reader.read();
          signal?.throwIfAborted();
          if (chunk.done) break;
          await handle.writeFile(chunk.value);
          hash.update(chunk.value);
          byteLength += chunk.value.byteLength;
        }
        await handle.sync();
        return { storagePath, hash: hash.digest("hex"), byteLength };
      } finally {
        signal?.removeEventListener("abort", abort);
        reader.releaseLock();
        await handle.close();
      }
    } catch (error) {
      await rm(storagePath, { force: true });
      throw error;
    }
  };

  return { writeFile, writeFileAtPath, writeStream, deleteFile, computeHash };
};
