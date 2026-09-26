import { createHash } from "node:crypto";
import { open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, posix, resolve } from "node:path";
import type { ArtifactFile, ArtifactMount, WorkspaceFilesMount } from "@pstdio/sdk/extensions";
import { createReadBoundary } from "../runtime/read-boundary";
import { normalizeArtifactMountPath } from "./path-normalization";
import { createSafeFileRoot, normalizeMountRelativePath } from "./safe-file-root";
import { createWorkspaceFileAccess, type WorkspaceFileAccess } from "./workspace-file-access";

type CreateArtifactMountInput = {
  repoRoot: string;
  /** Package name of the owning extension. */
  name: string;
  mountPath: string;
  signal?: AbortSignal;
};

const globPatternToRegExp = (pattern: string) => {
  const body = pattern.replace(/\*\*\/|\*\*|\*|[.+^${}()|[\]\\]/g, (token) => {
    if (token === "**/") return "(?:.*/)?";
    if (token === "**") return ".*";
    if (token === "*") return "[^/]*";
    return `\\${token}`;
  });
  return new RegExp(`^${body}$`);
};

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
const createFileMountState = (mountRoot: string, signal?: AbortSignal) => {
  const safeRoot = createSafeFileRoot(mountRoot);
  const read = createReadBoundary(signal);
  const mount: ArtifactMount = {
    exists: (path) => read(async () => Boolean(await safeRoot.tryResolveExisting(path))),
    readText: (path) =>
      read(async () => readFile((await safeRoot.resolveExisting(path)).operationPath, { encoding: "utf8", signal })),
    writeText: async (path, value) => {
      const { operationPath } = await safeRoot.resolveForWrite(path);
      await writeFile(operationPath, value, "utf8");
    },
    updateText: async (path, value) => {
      const { operationPath } = await safeRoot.resolveExisting(path);
      // Opening without O_CREAT keeps a racing delete authoritative. An unlinked
      // file handle can finish writing, but cannot put the file back in the mount.
      const file = await open(operationPath, "r+");
      try {
        await file.writeFile(value, "utf8");
        await file.truncate(Buffer.byteLength(value, "utf8"));
      } finally {
        await file.close();
      }
    },
    readBytes: (path) =>
      read(
        async () => new Uint8Array(await readFile((await safeRoot.resolveExisting(path)).operationPath, { signal })),
      ),
    writeBytes: async (path, value) => {
      const { operationPath } = await safeRoot.resolveForWrite(path);
      await writeFile(operationPath, value);
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
    },
  };
  return { mount, safeRoot };
};

/** Build an ArtifactMount scoped to an absolute filesystem root, rejecting path escapes. */
export const createFileMount = (mountRoot: string, signal?: AbortSignal): ArtifactMount =>
  createFileMountState(mountRoot, signal).mount;

let syncTmpCounter = 0;

type WorkspaceSyncState = {
  version: 1;
  dir: string;
  files: string[];
};

const workspaceSyncStateFile = (dir: string) => `${createHash("sha256").update(dir).digest("hex")}.json`;

const isPathInSyncDir = (dir: string, path: string) => (dir ? path.startsWith(`${dir}/`) : Boolean(path));

const readWorkspaceSyncState = async (stateMount: ArtifactMount, dir: string) => {
  const stateFile = workspaceSyncStateFile(dir);
  if (!(await stateMount.exists(stateFile))) return { stateFile, managedFiles: [] };

  const state = JSON.parse(await stateMount.readText(stateFile)) as WorkspaceSyncState;
  if (state.version !== 1 || state.dir !== dir || !Array.isArray(state.files)) {
    throw new Error(`Invalid workspace sync state for "${dir}"`);
  }

  const managedFiles = state.files.map((path) => normalizeMountRelativePath(path));
  if (managedFiles.some((path) => !isPathInSyncDir(dir, path))) {
    throw new Error(`Invalid workspace sync state for "${dir}"`);
  }
  return { stateFile, managedFiles };
};

/**
 * A file mount with {@link WorkspaceFilesMount.syncDir}: writes the given files atomically and prunes only
 * files recorded as managed by an earlier sync. Harness extensions use it to materialize their agent dir
 * (e.g. `.claude/skills`) without deleting repository-owned skills in the same directory.
 */
export const createWorkspaceFilesMount = (
  mountRoot: string,
  options: { syncStateRoot?: string; signal?: AbortSignal } = {},
): WorkspaceFilesMount & WorkspaceFileAccess => {
  const { mount, safeRoot } = createFileMountState(mountRoot, options.signal);

  const syncDir: WorkspaceFilesMount["syncDir"] = async (dir, files) => {
    if (!options.syncStateRoot) throw new Error("Workspace sync state root is required");

    const dirRel = normalizeMountRelativePath(dir);
    const stateMount = createFileMount(options.syncStateRoot);
    const { stateFile, managedFiles } = await readWorkspaceSyncState(stateMount, dirRel);
    const wanted = new Map<string, string>();
    for (const file of files) {
      const rel = normalizeMountRelativePath(posix.join(dirRel, file.path));
      // normalizeRelativePath only guards the mount root; a path like "../x" stays in the
      // root but escapes `dir`, so it would be written outside the synced subtree and never
      // pruned. Reject anything that does not land strictly under `dir`.
      if (dirRel && !rel.startsWith(`${dirRel}/`)) {
        throw new Error(`Workspace file path escapes "${dir}": ${file.path}`);
      }
      wanted.set(rel, file.content);
    }

    for (const [rel, content] of wanted) {
      const absolutePath = (await safeRoot.resolveForWrite(rel)).operationPath;
      const tmpRelativePath = `${rel}.${process.pid}.${syncTmpCounter++}.tmp`;
      const tmpPath = (await safeRoot.resolveForWrite(tmpRelativePath)).operationPath;
      await writeFile(tmpPath, content, "utf8");
      await rename(tmpPath, absolutePath);
    }

    for (const path of managedFiles) {
      if (!wanted.has(path) && (await createFileMount(mountRoot).exists(path))) await mount.delete(path);
    }

    const state: WorkspaceSyncState = { version: 1, dir: dirRel, files: [...wanted.keys()].sort() };
    await stateMount.writeText(stateFile, `${JSON.stringify(state)}\n`);
  };

  return { ...mount, ...createWorkspaceFileAccess(safeRoot), syncDir };
};

// Mounts live under a dedicated extension-storage root so extension package
// names can never collide with host-owned `.pstdio/` entries such as docs,
// reports, extensions, or config.json.
export const ARTIFACT_MOUNT_ROOT = ".pstdio/extension-storage";

export const createArtifactMount = (input: CreateArtifactMountInput): ArtifactMount => {
  const normalized = normalizeArtifactMountPath(input.mountPath);
  if (!normalized) {
    throw new Error(`Artifact mount path "${input.mountPath}" must stay under ${ARTIFACT_MOUNT_ROOT}/${input.name}/`);
  }

  const mountRoot = resolve(input.repoRoot, ...ARTIFACT_MOUNT_ROOT.split("/"), input.name, ...normalized.split("/"));
  return createFileMount(mountRoot, input.signal);
};
