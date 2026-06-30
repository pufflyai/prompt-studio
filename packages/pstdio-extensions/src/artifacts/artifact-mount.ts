import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import type { ArtifactFile, ArtifactMount, WorkspaceFilesMount } from "@pstdio/sdk/extensions";
import { normalizeArtifactMountPath } from "./path-normalization";

type CreateArtifactMountInput = {
  repoRoot: string;
  /** Package name of the owning extension. */
  name: string;
  mountPath: string;
};

const normalizeRelativePath = (path: string) => {
  if (path.includes("\0")) throw new Error("Artifact path escapes mount root");

  const slashPath = path.replaceAll("\\", "/");
  if (slashPath.startsWith("/")) throw new Error("Artifact path escapes mount root");

  const normalized = posix.normalize(slashPath);
  if (normalized === ".") return "";
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Artifact path escapes mount root");
  }

  return normalized.replace(/\/$/, "");
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
export const createFileMount = (mountRoot: string): ArtifactMount => {
  const resolvePath = (relativePath: string) => {
    const safe = normalizeRelativePath(relativePath);
    return {
      absolutePath: safe ? resolve(mountRoot, ...safe.split("/")) : mountRoot,
      relativePath: safe,
    };
  };

  return {
    exists: async (path) => existsSync(resolvePath(path).absolutePath),
    readText: async (path) => readFile(resolvePath(path).absolutePath, "utf8"),
    writeText: async (path, value) => {
      const { absolutePath } = resolvePath(path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, value, "utf8");
    },
    readBytes: async (path) => new Uint8Array(await readFile(resolvePath(path).absolutePath)),
    writeBytes: async (path, value) => {
      const { absolutePath } = resolvePath(path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, value);
    },
    list: async (pattern) => {
      // The scoped-walk shortcut must honor the same escape guard as every other
      // op: a pattern like "../../etc/**" would otherwise walk outside mountRoot.
      const prefix = pattern ? normalizeRelativePath(literalPrefixDir(pattern)) : "";
      const startDir = prefix ? resolve(mountRoot, ...prefix.split("/")) : mountRoot;
      if (!existsSync(startDir)) return [];
      const files: ArtifactFile[] = [];
      await walkFiles(mountRoot, startDir, files);
      const matcher = pattern ? globPatternToRegExp(pattern) : null;
      return files.filter((file) => !matcher || matcher.test(file.path)).sort((a, b) => a.path.localeCompare(b.path));
    },
    listDirs: async (path = "") => {
      const { absolutePath, relativePath } = resolvePath(path);
      if (!existsSync(absolutePath)) return [];
      const entries = await readdir(absolutePath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => toPosixPath(posix.join(relativePath, entry.name)))
        .sort((a, b) => a.localeCompare(b));
    },
    delete: async (path) => {
      const { absolutePath, relativePath } = resolvePath(path);
      if (!relativePath) throw new Error("Artifact path is required");
      await rm(absolutePath, { recursive: true, force: true });
    },
  };
};

let syncTmpCounter = 0;

/**
 * A file mount with {@link WorkspaceFilesMount.syncDir}: reconciles a subtree to exactly the given set —
 * each file written atomically (temp + rename), anything else under `dir` pruned. Harness extensions use
 * it to materialize their agent dir (e.g. `.claude/skills`) from the project skill catalog.
 */
export const createWorkspaceFilesMount = (mountRoot: string): WorkspaceFilesMount => {
  const mount = createFileMount(mountRoot);

  const syncDir: WorkspaceFilesMount["syncDir"] = async (dir, files) => {
    const dirRel = normalizeRelativePath(dir);
    const wanted = new Map<string, string>();
    for (const file of files) {
      const rel = normalizeRelativePath(posix.join(dirRel, file.path));
      // normalizeRelativePath only guards the mount root; a path like "../x" stays in the
      // root but escapes `dir`, so it would be written outside the synced subtree and never
      // pruned. Reject anything that does not land strictly under `dir`.
      if (dirRel && !rel.startsWith(`${dirRel}/`)) {
        throw new Error(`Workspace file path escapes "${dir}": ${file.path}`);
      }
      wanted.set(rel, file.content);
    }

    for (const [rel, content] of wanted) {
      const absolutePath = resolve(mountRoot, ...rel.split("/"));
      await mkdir(dirname(absolutePath), { recursive: true });
      const tmpPath = `${absolutePath}.${process.pid}.${syncTmpCounter++}.tmp`;
      await writeFile(tmpPath, content, "utf8");
      await rename(tmpPath, absolutePath);
    }

    for (const file of await mount.list(dirRel ? `${dirRel}/**` : undefined)) {
      if (!wanted.has(file.path)) await mount.delete(file.path);
    }
  };

  return { ...mount, syncDir };
};

export const createArtifactMount = (input: CreateArtifactMountInput): ArtifactMount => {
  const normalized = normalizeArtifactMountPath(input.mountPath);
  if (!normalized) {
    throw new Error(`Artifact mount path "${input.mountPath}" must stay under .pstdio/${input.name}/`);
  }

  const mountRoot = resolve(input.repoRoot, ".pstdio", input.name, ...normalized.split("/"));
  return createFileMount(mountRoot);
};
