import { canonicalStoragePath, renamedStoragePathOwner } from "pstdio-api-contracts/extension-identity";
import { migrateExtensionFiles } from "./extension-file-migration";
import { createSafeFileRoot, normalizeMountRelativePath } from "./safe-file-root";

export const createMigratedWorkspaceRoot = (workspace: string) => {
  const root = createSafeFileRoot(workspace);
  const pathFor = async (path: string) => {
    const normalized = normalizeMountRelativePath(path);
    const owner = renamedStoragePathOwner(normalized);
    if (owner) await migrateExtensionFiles(workspace, owner);
    return canonicalStoragePath(normalized);
  };
  return {
    resolveExisting: async (path: string) => root.resolveExisting(await pathFor(path)),
    tryResolveExisting: async (path: string) => root.tryResolveExisting(await pathFor(path)),
    resolveForWrite: async (path: string) => root.resolveForWrite(await pathFor(path)),
  };
};
