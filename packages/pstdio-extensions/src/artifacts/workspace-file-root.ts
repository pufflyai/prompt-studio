import { posix, relative } from "node:path";
import { canonicalStoragePath } from "pstdio-api-contracts/extension-host";
import { normalizeMountRelativePath, type SafeFileRoot, type SafeResolvedPath } from "./safe-file-root";
import { WorkspaceFileAccessError } from "./workspace-file-access-error";

const assertOutsideGit = (path: string) => {
  if (path.split(/[\\/]/).some((part) => part.toLowerCase() === ".git"))
    throw new WorkspaceFileAccessError(
      "Git metadata is unavailable through workspace file operations.",
      "git-metadata",
    );
};

/** Browsing and entry actions exclude Git metadata, including aliases that resolve into it. */
export const protectWorkspaceFileRoot = (root: SafeFileRoot) => {
  const normalizedPath = (path: string) => {
    const normalized = canonicalStoragePath(normalizeMountRelativePath(path));
    assertOutsideGit(normalized);
    return normalized;
  };
  const assertResolved = async (resolved: SafeResolvedPath) => {
    assertOutsideGit(relative((await root.resolveExisting("")).realPath, resolved.realPath));
    return resolved;
  };
  const resolveExisting = async (path: string) => assertResolved(await root.resolveExisting(normalizedPath(path)));
  return {
    resolveExisting,
    tryResolveExisting: async (path: string) => {
      const resolved = await root.tryResolveExisting(normalizedPath(path));
      return resolved ? assertResolved(resolved) : undefined;
    },
    resolveForWrite: async (path: string) => {
      const normalized = normalizedPath(path);
      // Entry creation requires an existing parent. Check its real path before a writer can
      // create anything through a symlink into metadata.
      await resolveExisting(posix.dirname(normalized));
      return assertResolved(await root.resolveForWrite(normalized));
    },
  };
};
