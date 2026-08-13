import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { posix } from "node:path";
import type { SafeFileRoot } from "./safe-file-root";

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

export class WorkspaceFileAccessError extends Error {
  readonly code: "not-found" | "not-file" | "too-large";

  constructor(message: string, code: "not-found" | "not-file" | "too-large") {
    super(message);
    this.name = "WorkspaceFileAccessError";
    this.code = code;
  }
}

const sortedDirectoryEntries = async (directory: string) =>
  (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.name !== ".git")
    .sort((left, right) => left.name.localeCompare(right.name));

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
    return { entries: matches.slice(0, limit), truncated: matches.length > limit };
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
    const size = Buffer.byteLength(value, "utf8");
    if (size > maxBytes) {
      throw new WorkspaceFileAccessError(`Workspace file is too large: ${path}`, "too-large");
    }
    await requireExistingFile(safeRoot, path);
    const resolved = await safeRoot.resolveExisting(path);
    await writeFile(resolved.operationPath, value, "utf8");
  },
});

export type WorkspaceFileAccess = ReturnType<typeof createWorkspaceFileAccess>;
