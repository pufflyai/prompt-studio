import { open, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, posix, relative, resolve } from "node:path";
import type { ArtifactFile, ArtifactMount, WorkspaceFilesMount } from "@pstdio/sdk/extensions";
import { createReadBoundary } from "../runtime/read-boundary";
import { ARTIFACT_MOUNT_ROOT } from "./extension-storage-path";
import { globPatternToRegExp } from "./file-glob";
import { normalizeArtifactMountPath } from "./path-normalization";
import { createSafeFileRoot, normalizeMountRelativePath } from "./safe-file-root";
import { createWorkspaceFileAccess, type WorkspaceFileAccess } from "./workspace-file-access";
import { type KeptWorkspaceFile, runAfterPendingSync, syncWorkspaceDir } from "./workspace-sync-dir";

type ArtifactMountLocation = {
  repoRoot: string;
  /** Package name of the owning extension. */
  name: string;
  mountPath: string;
};

type CreateArtifactMountInput = ArtifactMountLocation & {
  signal?: AbortSignal;
  /** Called after each write, update, or delete with the changed path under the mount root. */
  onWrite?: (path: string) => void;
};

type FileMountOptions = Pick<CreateArtifactMountInput, "signal" | "onWrite">;

const toPosixPath = (path: string) =>
  path
    .split(/[/\\]+/)
    .filter(Boolean)
    .join("/");

// The directory portion of a glob's literal prefix (everything before the first
// glob token). Lets list() start its walk at the addressed subtree instead of the
// whole mount root — important for repo-rooted mounts where the root is huge.
const literalPrefixDir = (pattern: string) => {
  const firstGlob = pattern.search(/[*?[\]]/);
  const literal = firstGlob === -1 ? pattern : pattern.slice(0, firstGlob);
  const slashIndex = literal.lastIndexOf("/");
  return slashIndex === -1 ? "" : literal.slice(0, slashIndex);
};

const walkFiles = async (root: string, current: string, files: ArtifactFile[], signal?: AbortSignal) => {
  signal?.throwIfAborted();
  for (const entry of await readdir(current, { withFileTypes: true })) {
    signal?.throwIfAborted();
    const absolutePath = join(current, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(root, absolutePath, files, signal);
      continue;
    }
    if (!entry.isFile()) continue;

    const fileStats = await stat(absolutePath);
    files.push({
      path: toPosixPath(absolutePath.slice(root.length)),
      size: fileStats.size,
      updatedAt: fileStats.mtime.toISOString(),
    });
  }
};

/** Build an ArtifactMount scoped to an absolute filesystem root, rejecting path escapes. */
const createFileMountState = (mountRoot: string, { signal, onWrite }: FileMountOptions = {}) => {
  const safeRoot = createSafeFileRoot(mountRoot);
  const read = createReadBoundary(signal);
  // Report paths under the root as given, not the root's resolved real path, so they match what a
  // watcher on that root reports. A write through a linked file changes the file it points to.
  const reportWrite = (relativePath: string, linkTarget = "") =>
    onWrite?.(join(resolve(mountRoot), ...relativePath.split("/"), linkTarget));
  const mount: ArtifactMount = {
    exists: (path) => read(async () => Boolean(await safeRoot.tryResolveExisting(path))),
    readText: (path) =>
      read(async () => readFile((await safeRoot.resolveExisting(path)).operationPath, { encoding: "utf8", signal })),
    writeText: async (path, value) => {
      const { operationPath, realPath, relativePath } = await safeRoot.resolveForWrite(path);
      await writeFile(operationPath, value, "utf8");
      reportWrite(relativePath, relative(operationPath, realPath));
    },
    updateText: async (path, value) => {
      const { operationPath, realPath, relativePath } = await safeRoot.resolveExisting(path);
      // Opening without O_CREAT keeps a racing delete authoritative. An unlinked
      // file handle can finish writing, but cannot put the file back in the mount.
      const file = await open(operationPath, "r+");
      try {
        await file.writeFile(value, "utf8");
        await file.truncate(Buffer.byteLength(value, "utf8"));
      } finally {
        await file.close();
      }
      reportWrite(relativePath, relative(operationPath, realPath));
    },
    readBytes: (path) =>
      read(
        async () => new Uint8Array(await readFile((await safeRoot.resolveExisting(path)).operationPath, { signal })),
      ),
    writeBytes: async (path, value) => {
      const { operationPath, realPath, relativePath } = await safeRoot.resolveForWrite(path);
      await writeFile(operationPath, value);
      reportWrite(relativePath, relative(operationPath, realPath));
    },
    list: (pattern) =>
      read(async () => {
        // The scoped-walk shortcut must honor the same escape guard as every other
        // op: a pattern like "../../etc/**" would otherwise walk outside mountRoot.
        const prefix = pattern ? normalizeMountRelativePath(literalPrefixDir(pattern)) : "";
        const start = await safeRoot.tryResolveExisting(prefix);
        if (!start) return [];
        const startDir = start.operationPath;
        const files: ArtifactFile[] = [];
        await walkFiles((await safeRoot.resolveExisting("")).operationPath, startDir, files, signal);
        const matcher = pattern ? globPatternToRegExp(pattern) : null;
        return files.filter((file) => !matcher || matcher.test(file.path)).sort((a, b) => a.path.localeCompare(b.path));
      }),
    listDirs: (path = "") =>
      read(async () => {
        const resolved = await safeRoot.tryResolveExisting(path);
        signal?.throwIfAborted();
        if (!resolved) return [];
        const entries = await readdir(resolved.operationPath, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => toPosixPath(posix.join(resolved.relativePath, entry.name)))
          .sort((a, b) => a.localeCompare(b));
      }),
    delete: async (path) => {
      const { operationPath, relativePath } = await safeRoot.resolveExisting(path);
      if (!relativePath) throw new Error("Artifact path is required");
      await rm(operationPath, { recursive: true, force: true });
      reportWrite(relativePath);
    },
  };
  return { mount, safeRoot };
};

/** Build an ArtifactMount scoped to an absolute filesystem root, rejecting path escapes. */
export const createFileMount = (mountRoot: string, signal?: AbortSignal): ArtifactMount =>
  createFileMountState(mountRoot, { signal }).mount;

/**
 * A file mount with {@link WorkspaceFilesMount.syncDir}. Harness extensions use it to materialize their
 * agent dir (e.g. `.claude/skills`). It changes only files it owns, so repository skills and local edits
 * in the same dir stay. See {@link syncWorkspaceDir}.
 */
export const createWorkspaceFilesMount = (
  mountRoot: string,
  options: { syncStateRoot?: string; signal?: AbortSignal; onKeptFile?: (file: KeptWorkspaceFile) => void } = {},
): WorkspaceFilesMount & WorkspaceFileAccess => {
  const { mount, safeRoot } = createFileMountState(mountRoot, { signal: options.signal });

  const syncDir: WorkspaceFilesMount["syncDir"] = (dir, files) => {
    const { syncStateRoot } = options;
    if (!syncStateRoot) return Promise.reject(new Error("Workspace sync state root is required"));
    return runAfterPendingSync(resolve(mountRoot, normalizeMountRelativePath(dir)), () =>
      syncWorkspaceDir({
        safeRoot,
        stateMount: createFileMount(syncStateRoot),
        dir,
        files,
        onKeptFile: options.onKeptFile,
      }),
    );
  };

  return { ...mount, ...createWorkspaceFileAccess(safeRoot), syncDir };
};

// Mounts live under a dedicated extension-storage root so extension package
// names can never collide with host-owned `.pstdio/` entries such as docs,
// reports, extensions, or config.json.
export { ARTIFACT_MOUNT_ROOT } from "./extension-storage-path";

/** The absolute folder of a mount in one workspace root. */
export const resolveArtifactMountRoot = (input: ArtifactMountLocation) => {
  const normalized = normalizeArtifactMountPath(input.mountPath);
  if (!normalized) {
    throw new Error(`Artifact mount path "${input.mountPath}" must stay under ${ARTIFACT_MOUNT_ROOT}/${input.name}/`);
  }
  return resolve(input.repoRoot, ...ARTIFACT_MOUNT_ROOT.split("/"), input.name, ...normalized.split("/"));
};

export const createArtifactMount = (input: CreateArtifactMountInput): ArtifactMount =>
  createFileMountState(resolveArtifactMountRoot(input), input).mount;
