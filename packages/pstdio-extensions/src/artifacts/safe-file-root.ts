import { mkdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, posix, relative, resolve } from "node:path";
import { isExtensionIdentityBackup } from "./extension-identity-backup";

export const normalizeMountRelativePath = (path: string) => {
  if (path.includes("\0") || path.includes("\\")) {
    throw new Error("Artifact path escapes mount root");
  }
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) {
    throw new Error("Artifact path escapes mount root");
  }

  const normalized = posix.normalize(path);
  if (normalized === ".") return "";
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Artifact path escapes mount root");
  }

  return normalized.replace(/\/$/, "");
};

const assertContained = (root: string, target: string) => {
  const pathFromRoot = relative(root, target);
  if (pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))) return;
  throw new Error("Artifact path escapes mount root");
};

const isMissingFileError = (error: unknown) =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";

export interface SafeResolvedPath {
  operationPath: string;
  realPath: string;
  relativePath: string;
}

export const createSafeFileRoot = (mountRoot: string) => {
  const absoluteRoot = resolve(mountRoot);

  const resolveRoot = async (create: boolean) => {
    if (create) await mkdir(absoluteRoot, { recursive: true });
    const root = await realpath(absoluteRoot);
    if (isExtensionIdentityBackup(root)) throw new Error("Extension migration originals are retained by the host");
    return root;
  };

  const resolveExisting = async (path: string): Promise<SafeResolvedPath> => {
    const relativePath = normalizeMountRelativePath(path);
    if (isExtensionIdentityBackup(join(absoluteRoot, relativePath)))
      throw new Error("Extension migration originals are retained by the host");
    const root = await resolveRoot(false);
    const operationPath = relativePath ? join(root, ...relativePath.split("/")) : root;
    const realPath = await realpath(operationPath);
    assertContained(root, realPath);
    if (isExtensionIdentityBackup(realPath)) throw new Error("Extension migration originals are retained by the host");
    return { operationPath, realPath, relativePath };
  };

  const tryResolveExisting = async (path: string) => {
    try {
      return await resolveExisting(path);
    } catch (error) {
      if (isMissingFileError(error)) return undefined;
      throw error;
    }
  };

  const ensureDirectory = async (root: string, relativePath: string) => {
    let current = root;
    for (const segment of relativePath.split("/").filter(Boolean)) {
      current = join(current, segment);
      // Another writer can create the same folder at the same time. The checks below still
      // reject a folder that resolves outside the root or is not a folder.
      await mkdir(current).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      });
      const currentRealPath = await realpath(current);
      assertContained(root, currentRealPath);
      if (isExtensionIdentityBackup(currentRealPath))
        throw new Error("Extension migration originals are retained by the host");
      if (!(await stat(currentRealPath)).isDirectory()) {
        throw new Error(`Artifact directory is not a directory: ${relativePath}`);
      }
      current = currentRealPath;
    }
    return current;
  };

  const resolveForWrite = async (path: string): Promise<SafeResolvedPath> => {
    const relativePath = normalizeMountRelativePath(path);
    if (isExtensionIdentityBackup(join(absoluteRoot, relativePath)))
      throw new Error("Extension migration originals are retained by the host");
    const root = await resolveRoot(true);
    const parent = posix.dirname(relativePath);
    const safeParent = parent === "." ? "" : parent;
    const realParent = await ensureDirectory(root, safeParent);
    const operationPath = relativePath ? join(root, ...relativePath.split("/")) : root;
    const existing = await tryResolveExisting(relativePath);
    if (existing) return existing;
    const realPath = relativePath ? join(realParent, posix.basename(relativePath)) : root;
    return { operationPath, realPath, relativePath };
  };

  return { resolveExisting, resolveForWrite, tryResolveExisting };
};

export type SafeFileRoot = ReturnType<typeof createSafeFileRoot>;
