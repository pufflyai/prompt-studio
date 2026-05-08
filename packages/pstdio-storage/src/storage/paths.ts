import fs from "node:fs";
import path from "node:path";
import { expandHomePath, resolvePstdioStoragePath } from "pstdio-paths";

export const resolveStorageRoot = (storagePath?: string) => {
  return expandHomePath(storagePath ?? process.env.PSTDIO_STORAGE_PATH ?? resolvePstdioStoragePath());
};

export const ensureStorageRoot = (storageRoot: string) => {
  fs.mkdirSync(storageRoot, { recursive: true });
};

export const ensureProjectStorageRoot = (storageRoot: string, projectId: string) => {
  fs.mkdirSync(path.join(storageRoot, projectId), { recursive: true });
};

export const resolveFileStoragePath = (storageRoot: string, projectId: string, fileId: string) =>
  path.join(storageRoot, projectId, fileId);
