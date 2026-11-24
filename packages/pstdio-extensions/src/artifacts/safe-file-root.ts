import { type BigIntStats, lstatSync } from "node:fs";
import { mkdir, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, posix, relative, resolve } from "node:path";
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

export const filesystemIdentity = ({ dev, ino, birthtimeNs }: Pick<BigIntStats, "dev" | "ino" | "birthtimeNs">) =>
  `${dev}:${ino}:${birthtimeNs}`;

export const readArtifactFileState = (path: string) => {
  // An ancestor that was removed or replaced by a file makes this path absent.
  try {
    const stats = lstatSync(path, { bigint: true, throwIfNoEntry: false });
    if (!stats) return null;
    return {
      identity: filesystemIdentity(stats),
      size: stats.size,
      mtime: stats.mtimeNs,
      ctime: stats.ctimeNs,
      directory: stats.isDirectory(),
    };
  } catch {
    return null;
  }
};

export type ArtifactParentWrite = {
  path: string;
  before: ReturnType<typeof readArtifactFileState>;
  after: ReturnType<typeof readArtifactFileState>;
};

export const observeArtifactParentWrite = (path: string) => {
  const parent = dirname(path);
  const before = readArtifactFileState(parent);
  return (): ArtifactParentWrite => ({ path: parent, before, after: readArtifactFileState(parent) });
};

type OnDirectoryCreated = (path: string, identity: string, parentWrite: ArtifactParentWrite) => void;

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

  const ensureDirectory = async (root: string, relativePath: string, onDirectoryCreated?: OnDirectoryCreated) => {
    let current = root;
    for (const segment of relativePath.split("/").filter(Boolean)) {
      current = join(current, segment);
      const parentWrite = onDirectoryCreated && observeArtifactParentWrite(join(absoluteRoot, relative(root, current)));
      // Another writer can create the same folder at the same time. The checks below still
      // reject a folder that resolves outside the root or is not a folder.
      const created = await mkdir(current).then(
        () => true,
        (error: NodeJS.ErrnoException) => {
          if (error.code !== "EEXIST") throw error;
          return false;
        },
      );
      const currentRealPath = await realpath(current);
      assertContained(root, currentRealPath);
      if (isExtensionIdentityBackup(currentRealPath))
        throw new Error("Extension migration originals are retained by the host");
      const stats = await stat(currentRealPath, { bigint: true });
      if (!stats.isDirectory()) {
        throw new Error(`Artifact directory is not a directory: ${relativePath}`);
      }
      if (created && parentWrite)
        onDirectoryCreated?.(
          join(absoluteRoot, relative(root, currentRealPath)),
          filesystemIdentity(stats),
          parentWrite(),
        );
      current = currentRealPath;
    }
    return current;
  };

  const resolveForWrite = async (path: string, onDirectoryCreated?: OnDirectoryCreated): Promise<SafeResolvedPath> => {
    const relativePath = normalizeMountRelativePath(path);
    if (isExtensionIdentityBackup(join(absoluteRoot, relativePath)))
      throw new Error("Extension migration originals are retained by the host");
    const root = await resolveRoot(true);
    const parent = posix.dirname(relativePath);
    const safeParent = parent === "." ? "" : parent;
    const realParent = await ensureDirectory(root, safeParent, onDirectoryCreated);
    const operationPath = relativePath ? join(root, ...relativePath.split("/")) : root;
    const existing = await tryResolveExisting(relativePath);
    if (existing) return existing;
    const realPath = relativePath ? join(realParent, posix.basename(relativePath)) : root;
    return { operationPath, realPath, relativePath };
  };

  return { resolveExisting, resolveForWrite, tryResolveExisting };
};

export type SafeFileRoot = ReturnType<typeof createSafeFileRoot>;
