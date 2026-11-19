import { lstat, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, posix, relative, sep } from "node:path";
import { type createSafeFileRoot, normalizeMountRelativePath } from "pstdio-extensions";

const missing = (error: NodeJS.ErrnoException) => {
  if (error.code !== "ENOENT") throw error;
};

const resolveLink = (error: NodeJS.ErrnoException) => {
  if (error.code === "ELOOP" || error.code === "ENOTDIR") return null;
  return missing(error);
};

const isContained = (root: string, path: string) => {
  const fromRoot = relative(root, path);
  return !isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`);
};

const resolveMountRoot = async (packageRoot: string, mountRoot: string) => {
  const owner = await realpath(packageRoot).catch(missing);
  if (!owner) return;
  // Check an existing parent too, so a missing nested root cannot be created through an escaping link.
  for (let candidate = mountRoot; candidate !== packageRoot; candidate = dirname(candidate)) {
    const root = await realpath(candidate).catch(resolveLink);
    if (root === null || (root && !isContained(owner, root))) return null;
    if (root) return candidate === mountRoot ? root : undefined;
  }
};

export const assertArtifactBoundary = async (boundary: ReturnType<typeof createSafeFileRoot>, path: string) => {
  let current = normalizeMountRelativePath(path);
  while (
    !(await boundary.tryResolveExisting(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOTDIR") throw error;
    })) &&
    current
  ) {
    const parent = posix.dirname(current);
    current = parent === "." ? "" : parent;
  }
};

export const canLookupArtifactPath = async (
  packageRoot: string,
  mountRoot: string,
  path: string,
  hasTrackedFile: () => Promise<boolean>,
) => {
  const root = await resolveMountRoot(packageRoot, mountRoot);
  // A path without a local copy may still exist in shared storage.
  if (!root) return root !== null;

  let directory = root;
  let throughLink = false;
  const segments = path.split("/");
  for (const [index, name] of segments.entries()) {
    const candidate = join(directory, name);
    const entry = await lstat(candidate).catch((error: NodeJS.ErrnoException) => {
      return error.code === "ENOTDIR" ? null : missing(error);
    });
    if (entry === null) return false;
    if (!entry) break;

    // The filesystem may resolve case or Unicode aliases. Only the spelling on disk
    // can be imported into shared storage, where each exact path is a separate identity.
    if (!(await readdir(directory)).includes(name)) return false;
    if (!entry.isSymbolicLink()) {
      // An accepted remote directory may be replacing a regular file in the local copy.
      if (index < segments.length - 1 && !entry.isDirectory()) return entry.isFile() && hasTrackedFile();
      directory = candidate;
      continue;
    }

    const target = await realpath(candidate).catch(resolveLink);
    if (!target) return false;
    if (!isContained(root, target)) return false;
    throughLink = true;
    directory = target;
  }
  // Directory listings skip symlinks. Keep serving links for already tracked files.
  return !throughLink || hasTrackedFile();
};
