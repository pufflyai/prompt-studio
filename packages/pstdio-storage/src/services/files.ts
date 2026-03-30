import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureProjectStorageRoot, resolveFileStoragePath } from "../storage/paths";

export const createFilesStorageService = (storageRoot: string) => {
  const writeFile = (projectId: string, fileId: string, data: Buffer) => {
    ensureProjectStorageRoot(storageRoot, projectId);
    const storagePath = resolveFileStoragePath(storageRoot, projectId, fileId);
    fs.writeFileSync(storagePath, data);
    return storagePath;
  };

  const deleteFile = (storagePath: string) => {
    if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
  };

  const removeProjectStorage = (projectId: string) => {
    const projectDir = path.join(storageRoot, projectId);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  };

  const computeHash = (data: Buffer) => createHash("sha256").update(data).digest("hex");

  return { writeFile, deleteFile, removeProjectStorage, computeHash };
};
