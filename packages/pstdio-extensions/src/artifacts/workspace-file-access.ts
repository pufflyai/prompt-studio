import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { posix } from "node:path";
import { normalizeMountRelativePath, type SafeFileRoot } from "./safe-file-root";

export interface WorkspaceMountEntry {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
}

export interface WorkspaceMountSearchResult {
  entries: WorkspaceMountEntry[];
  truncated: boolean;
}

export interface WorkspaceMountFile {
  bytes: Uint8Array;
  size: number;
}

export interface WorkspaceMountResolvedEntry {
  absolutePath: string;
  type: "file" | "directory";
}

export class WorkspaceFileAccessError extends Error {
  readonly code: "already-exists" | "invalid-target" | "not-found" | "not-file" | "too-large";

  constructor(message: string, code: "already-exists" | "invalid-target" | "not-found" | "not-file" | "too-large") {
    super(message);
    this.name = "WorkspaceFileAccessError";
    this.code = code;
  }
}

const sortedDirectoryEntries = async (directory: string) =>
  (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.name !== ".git")
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

const rejectsGitMetadata = (path: string) => path === ".git" || path.startsWith(".git/");

const compareWorkspaceEntries = (left: WorkspaceMountEntry, right: WorkspaceMountEntry) => {
  if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
  return left.path.localeCompare(right.path);
};

const workspaceEntry = async (
  safeRoot: SafeFileRoot,
  parentPath: string,
  name: string,
): Promise<WorkspaceMountEntry | undefined> => {
  const path = posix.join(parentPath, name);
  let resolved: Awaited<ReturnType<SafeFileRoot["resolveExisting"]>>;
  try {
    resolved = await safeRoot.resolveExisting(path);
  } catch (error) {
    if (error instanceof Error && error.message.includes("escapes mount root")) return undefined;
    throw error;
  }

  const fileStats = await stat(resolved.operationPath);
  if (!fileStats.isDirectory() && !fileStats.isFile()) return undefined;
  return {
    path,
    name,
    type: fileStats.isDirectory() ? "directory" : "file",
    ...(fileStats.isFile() ? { size: fileStats.size } : {}),
    modifiedAt: fileStats.mtime.toISOString(),
  };
};

const requireExistingFile = async (safeRoot: SafeFileRoot, path: string) => {
  let resolved: Awaited<ReturnType<SafeFileRoot["resolveExisting"]>>;
  try {
    resolved = await safeRoot.resolveExisting(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WorkspaceFileAccessError(`Workspace file not found: ${path}`, "not-found");
    }
    throw error;
  }
  const fileStats = await stat(resolved.operationPath);
  if (!fileStats.isFile()) {
    throw new WorkspaceFileAccessError(`Workspace file is not a regular file: ${path}`, "not-file");
  }
  return { fileStats, resolved };
};

const requireExistingEntry = async (safeRoot: SafeFileRoot, path: string) => {
  let resolved: Awaited<ReturnType<SafeFileRoot["resolveExisting"]>>;
  try {
    resolved = await safeRoot.resolveExisting(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WorkspaceFileAccessError(`Workspace entry not found: ${path}`, "not-found");
    }
    throw error;
  }

  const entryStats = await stat(resolved.realPath);
  if (!entryStats.isFile() && !entryStats.isDirectory()) {
    throw new WorkspaceFileAccessError(`Workspace entry is not a regular file or directory: ${path}`, "not-file");
  }
  return { entryStats, resolved };
};

const fileSize = (value: string, maxBytes: number, path: string) => {
  const size = Buffer.byteLength(value, "utf8");
  if (size > maxBytes) {
    throw new WorkspaceFileAccessError(`Workspace file is too large: ${path}`, "too-large");
  }
  return size;
};

const requireExistingParent = async (safeRoot: SafeFileRoot, path: string) => {
  const normalizedPath = normalizeMountRelativePath(path);
  const parentPath = posix.dirname(normalizedPath);
  try {
    const parent = await safeRoot.resolveExisting(parentPath === "." ? "" : parentPath);
    if (!(await stat(parent.operationPath)).isDirectory()) {
      throw new WorkspaceFileAccessError(`Workspace directory not found: ${parentPath}`, "not-found");
    }
  } catch (error) {
    if (error instanceof WorkspaceFileAccessError) throw error;
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WorkspaceFileAccessError(`Workspace directory not found: ${parentPath}`, "not-found");
    }
    throw error;
  }
  return normalizedPath;
};

const throwWorkspaceMoveError = (error: unknown, destinationPath: string) => {
  const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
  if (code === "EEXIST" || code === "ENOTEMPTY") {
    throw new WorkspaceFileAccessError(`Workspace entry already exists: ${destinationPath}`, "already-exists");
  }
  if (code === "EINVAL") {
    throw new WorkspaceFileAccessError("A workspace directory cannot be moved inside itself.", "invalid-target");
  }
  throw error;
};

interface WorkspaceSearchContext {
  safeRoot: SafeFileRoot;
  normalizedQuery: string;
  limit: number;
  matches: WorkspaceMountEntry[];
  visitedDirectories: Set<string>;
}

const collectSearchEntry = async (context: WorkspaceSearchContext, entry: WorkspaceMountEntry) => {
  if (entry.path.toLocaleLowerCase().includes(context.normalizedQuery)) {
    context.matches.push(entry);
    if (context.matches.length > context.limit) return false;
  }
  if (entry.type !== "directory") return true;
  return searchWorkspaceDirectory(context, entry.path);
};

async function searchWorkspaceDirectory(context: WorkspaceSearchContext, directoryPath: string): Promise<boolean> {
  const directory = await context.safeRoot.resolveExisting(directoryPath);
  if (context.visitedDirectories.has(directory.realPath)) return true;
  context.visitedDirectories.add(directory.realPath);

  for (const item of await sortedDirectoryEntries(directory.operationPath)) {
    const entry = await workspaceEntry(context.safeRoot, directoryPath, item.name);
    if (entry && !(await collectSearchEntry(context, entry))) return false;
  }
  return true;
}

export const createWorkspaceFileAccess = (safeRoot: SafeFileRoot) => ({
  async resolveEntryPath(path: string): Promise<WorkspaceMountResolvedEntry> {
    const { entryStats, resolved } = await requireExistingEntry(safeRoot, path);
    return { absolutePath: resolved.realPath, type: entryStats.isDirectory() ? "directory" : "file" };
  },

  async listEntries(path = "") {
    const directory = await safeRoot.resolveExisting(path);
    const directoryStats = await stat(directory.operationPath);
    if (!directoryStats.isDirectory()) {
      throw new WorkspaceFileAccessError(`Workspace directory not found: ${path}`, "not-found");
    }
    const entries = await sortedDirectoryEntries(directory.operationPath);
    const results = await Promise.all(entries.map((entry) => workspaceEntry(safeRoot, path, entry.name)));
    return results.filter((entry): entry is WorkspaceMountEntry => Boolean(entry));
  },

  async searchEntries(query: string, limit: number, path = ""): Promise<WorkspaceMountSearchResult> {
    const matches: WorkspaceMountEntry[] = [];
    await searchWorkspaceDirectory(
      {
        safeRoot,
        normalizedQuery: query.toLocaleLowerCase(),
        limit,
        matches,
        visitedDirectories: new Set(),
      },
      path,
    );
    return { entries: matches.sort(compareWorkspaceEntries).slice(0, limit), truncated: matches.length > limit };
  },

  async readFile(path: string, maxBytes: number): Promise<WorkspaceMountFile> {
    const { fileStats } = await requireExistingFile(safeRoot, path);
    if (fileStats.size > maxBytes) {
      throw new WorkspaceFileAccessError(`Workspace file is too large: ${path}`, "too-large");
    }
    const resolved = await safeRoot.resolveExisting(path);
    return { bytes: new Uint8Array(await readFile(resolved.operationPath)), size: fileStats.size };
  },

  async writeTextFile(path: string, value: string, maxBytes: number) {
    fileSize(value, maxBytes, path);
    await requireExistingFile(safeRoot, path);
    const resolved = await safeRoot.resolveExisting(path);
    await writeFile(resolved.operationPath, value, "utf8");
  },

  async createTextFile(path: string, value: string, maxBytes: number) {
    fileSize(value, maxBytes, path);
    const normalizedPath = await requireExistingParent(safeRoot, path);
    if (await safeRoot.tryResolveExisting(normalizedPath)) {
      throw new WorkspaceFileAccessError(`Workspace file already exists: ${path}`, "already-exists");
    }
    const resolved = await safeRoot.resolveForWrite(normalizedPath);
    try {
      await writeFile(resolved.operationPath, value, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new WorkspaceFileAccessError(`Workspace file already exists: ${path}`, "already-exists");
      }
      throw error;
    }
  },

  async createDirectory(path: string) {
    const normalizedPath = await requireExistingParent(safeRoot, path);
    if (await safeRoot.tryResolveExisting(normalizedPath)) {
      throw new WorkspaceFileAccessError(`Workspace entry already exists: ${path}`, "already-exists");
    }
    const resolved = await safeRoot.resolveForWrite(normalizedPath);
    try {
      await mkdir(resolved.operationPath);
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new WorkspaceFileAccessError(`Workspace entry already exists: ${path}`, "already-exists");
      }
      throw error;
    }
  },

  async moveEntry(sourcePath: string, destinationPath: string) {
    const normalizedSource = normalizeMountRelativePath(sourcePath);
    const normalizedDestination = await requireExistingParent(safeRoot, destinationPath);
    if (rejectsGitMetadata(normalizedSource) || rejectsGitMetadata(normalizedDestination)) {
      throw new WorkspaceFileAccessError("Git metadata cannot be moved.", "not-file");
    }
    const { entryStats, resolved: source } = await requireExistingEntry(safeRoot, normalizedSource);
    if (!source.relativePath) {
      throw new WorkspaceFileAccessError("The workspace root cannot be moved.", "invalid-target");
    }
    if (normalizedDestination === normalizedSource) return;
    if (entryStats.isDirectory() && normalizedDestination.startsWith(`${normalizedSource}/`)) {
      throw new WorkspaceFileAccessError("A workspace directory cannot be moved inside itself.", "invalid-target");
    }
    if (await safeRoot.tryResolveExisting(normalizedDestination)) {
      throw new WorkspaceFileAccessError(`Workspace entry already exists: ${destinationPath}`, "already-exists");
    }
    const destination = await safeRoot.resolveForWrite(normalizedDestination);
    try {
      await rename(source.operationPath, destination.operationPath);
    } catch (error) {
      throwWorkspaceMoveError(error, destinationPath);
    }
  },

  async deleteEntry(path: string) {
    const normalizedPath = normalizeMountRelativePath(path);
    if (rejectsGitMetadata(normalizedPath)) {
      throw new WorkspaceFileAccessError("Git metadata cannot be deleted.", "not-file");
    }
    const { resolved } = await requireExistingEntry(safeRoot, normalizedPath);
    if (!resolved.relativePath) {
      throw new WorkspaceFileAccessError("The workspace root cannot be deleted.", "not-file");
    }
    await rm(resolved.operationPath, { recursive: true });
  },
});

export type WorkspaceFileAccess = ReturnType<typeof createWorkspaceFileAccess>;
