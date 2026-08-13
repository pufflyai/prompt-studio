import { readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, posix, resolve } from "node:path";
import type { ArtifactFile, ArtifactMount, WorkspaceFilesMount } from "@pstdio/sdk/extensions";
import { normalizeArtifactMountPath } from "./path-normalization";
import { createSafeFileRoot, normalizeMountRelativePath } from "./safe-file-root";
import { createWorkspaceFileAccess, type WorkspaceFileAccess } from "./workspace-file-access";

type CreateArtifactMountInput = {
  repoRoot: string;
  /** Package name of the owning extension. */
  name: string;
  mountPath: string;
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

const walkFiles = async (root: string, current: string, files: ArtifactFile[]) => {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolutePath = join(current, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(root, absolutePath, files);
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
const createFileMountState = (mountRoot: string) => {
  const safeRoot = createSafeFileRoot(mountRoot);
  const mount: ArtifactMount = {
    exists: async (path) => Boolean(await safeRoot.tryResolveExisting(path)),
    readText: async (path) => readFile((await safeRoot.resolveExisting(path)).operationPath, "utf8"),
    writeText: async (path, value) => {
      const { operationPath } = await safeRoot.resolveForWrite(path);
      await writeFile(operationPath, value, "utf8");
    },
    readBytes: async (path) => new Uint8Array(await readFile((await safeRoot.resolveExisting(path)).operationPath)),
    writeBytes: async (path, value) => {
      const { operationPath } = await safeRoot.resolveForWrite(path);
      await writeFile(operationPath, value);
    },
    list: async (pattern) => {
      // The scoped-walk shortcut must honor the same escape guard as every other
      // op: a pattern like "../../etc/**" would otherwise walk outside mountRoot.
      const prefix = pattern ? normalizeMountRelativePath(literalPrefixDir(pattern)) : "";
      const start = await safeRoot.tryResolveExisting(prefix);
      if (!start) return [];
      const startDir = start.operationPath;
      const files: ArtifactFile[] = [];
      await walkFiles((await safeRoot.resolveExisting("")).operationPath, startDir, files);
      const matcher = pattern ? globPatternToRegExp(pattern) : null;
      return files.filter((file) => !matcher || matcher.test(file.path)).sort((a, b) => a.path.localeCompare(b.path));
    },
    listDirs: async (path = "") => {
      const resolved = await safeRoot.tryResolveExisting(path);
      if (!resolved) return [];
      const entries = await readdir(resolved.operationPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => toPosixPath(posix.join(resolved.relativePath, entry.name)))
        .sort((a, b) => a.localeCompare(b));
    },
    delete: async (path) => {
      const { operationPath, relativePath } = await safeRoot.resolveExisting(path);
      if (!relativePath) throw new Error("Artifact path is required");
      await rm(operationPath, { recursive: true, force: true });
    },
  };
  return { mount, safeRoot };
};

/** Build an ArtifactMount scoped to an absolute filesystem root, rejecting path escapes. */
export const createFileMount = (mountRoot: string): ArtifactMount => createFileMountState(mountRoot).mount;

let syncTmpCounter = 0;

/**
 * A file mount with {@link WorkspaceFilesMount.syncDir}: reconciles a subtree to exactly the given set —
 * each file written atomically (temp + rename), anything else under `dir` pruned. Harness extensions use
 * it to materialize their agent dir (e.g. `.claude/skills`) from the project skill catalog.
 */
export const createWorkspaceFilesMount = (mountRoot: string): WorkspaceFilesMount & WorkspaceFileAccess => {
  const { mount, safeRoot } = createFileMountState(mountRoot);

  const syncDir: WorkspaceFilesMount["syncDir"] = async (dir, files) => {
    const dirRel = normalizeMountRelativePath(dir);
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

    for (const file of await mount.list(dirRel ? `${dirRel}/**` : undefined)) {
      if (!wanted.has(file.path)) await mount.delete(file.path);
    }
  };

  return { ...mount, ...createWorkspaceFileAccess(safeRoot), syncDir };
};

export const createArtifactMount = (input: CreateArtifactMountInput): ArtifactMount => {
  const normalized = normalizeArtifactMountPath(input.mountPath);
  if (!normalized) {
    throw new Error(`Artifact mount path "${input.mountPath}" must stay under .pstdio/${input.name}/`);
  }

  const mountRoot = resolve(input.repoRoot, ".pstdio", input.name, ...normalized.split("/"));
  return createFileMount(mountRoot);
};
