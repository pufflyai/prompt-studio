import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const expandHomeDirectory = (value: string) => {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
};

export const resolveStorageRoot = (storagePath?: string) => {
  if (!storagePath) {
    throw new Error("Storage path is required. Set PSTDIO_STORAGE_PATH or pass storagePath.");
  }

  return expandHomeDirectory(storagePath);
};

export const ensureStorageRoot = (storageRoot: string) => {
  fs.mkdirSync(storageRoot, { recursive: true });
};

export const ensureProjectStorageRoot = (storageRoot: string, projectId: string) => {
  fs.mkdirSync(path.join(storageRoot, projectId), { recursive: true });
};

export const resolveFileStoragePath = (storageRoot: string, projectId: string, fileId: string) =>
  path.join(storageRoot, projectId, fileId);
