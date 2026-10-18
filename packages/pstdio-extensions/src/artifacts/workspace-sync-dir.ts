import { createHash } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { posix } from "node:path";
import type { ArtifactMount, WorkspaceSyncFile } from "@pstdio/sdk/extensions";
import { normalizeMountRelativePath, type SafeFileRoot } from "./safe-file-root";

/** A file `syncDir` left in place because Prompt Studio does not own its current content. */
export interface KeptWorkspaceFile {
  /** Path under the workspace root. */
  path: string;
  /** `unmanaged`: Prompt Studio never wrote it. `edited`: it changed after Prompt Studio wrote it. */
  reason: "unmanaged" | "edited";
}

type ManagedFile = { path: string; sha256: string };

type WorkspaceSyncState = {
  version: 1;
  dir: string;
  // Plain strings come from state written before content hashes were recorded.
  files: Array<ManagedFile | string>;
};

// `null` marks a file from state without hashes. See readWorkspaceSyncState.
type OwnedFiles = Map<string, string | null>;

const hashContent = (content: string | Buffer) => createHash("sha256").update(content).digest("hex");

const workspaceSyncStateFile = (dir: string) => `${hashContent(dir)}.json`;

const isPathInSyncDir = (dir: string, path: string) => (dir ? path.startsWith(`${dir}/`) : Boolean(path));

const readWorkspaceSyncState = async (stateMount: ArtifactMount, dir: string) => {
  const stateFile = workspaceSyncStateFile(dir);
  const owned: OwnedFiles = new Map();
  if (!(await stateMount.exists(stateFile))) return { stateFile, owned };

  const state = JSON.parse(await stateMount.readText(stateFile)) as WorkspaceSyncState;
  if (state.version !== 1 || state.dir !== dir || !Array.isArray(state.files)) {
    throw new Error(`Invalid workspace sync state for "${dir}"`);
  }

  for (const entry of state.files) {
    // Older state lists paths only. The sync that wrote it replaced those files on every run, so they
    // are still treated as owned once. That keeps unedited files updating, and this sync records hashes.
    const path = normalizeMountRelativePath(typeof entry === "string" ? entry : entry.path);
    if (!isPathInSyncDir(dir, path)) throw new Error(`Invalid workspace sync state for "${dir}"`);
    owned.set(path, typeof entry === "string" ? null : entry.sha256);
  }
  return { stateFile, owned };
};

const readCurrentHash = async (safeRoot: SafeFileRoot, path: string) => {
  const existing = await safeRoot.tryResolveExisting(path);
  return existing ? hashContent(await readFile(existing.operationPath)) : undefined;
};

// A recorded hash of `null` has no content to compare, so the file counts as unedited.
const isUnedited = (owned: OwnedFiles, path: string, currentHash: string) => {
  const recorded = owned.get(path);
  return recorded === null || recorded === currentHash;
};

let syncTmpCounter = 0;

// Two syncs of one folder at once race on creating new folders and, on Windows, on renaming over
// the same file. Syncs of the same folder in this process run one after another.
const pendingSyncs = new Map<string, Promise<void>>();

export const runAfterPendingSync = (key: string, sync: () => Promise<void>) => {
  const next = (pendingSyncs.get(key) ?? Promise.resolve()).catch(() => {}).then(sync);
  pendingSyncs.set(key, next);
  const forget = () => {
    if (pendingSyncs.get(key) === next) pendingSyncs.delete(key);
  };
  void next.then(forget, forget);
  return next;
};

const resolveWantedFiles = (dir: string, files: WorkspaceSyncFile[]) => {
  const wanted = new Map<string, string>();
  for (const file of files) {
    const rel = normalizeMountRelativePath(posix.join(dir, file.path));
    // normalizeRelativePath only guards the mount root; a path like "../x" stays in the
    // root but escapes `dir`, so it would be written outside the synced subtree and never
    // pruned. Reject anything that does not land strictly under `dir`.
    if (dir && !rel.startsWith(`${dir}/`)) {
      throw new Error(`Workspace file path escapes "${dir}": ${file.path}`);
    }
    wanted.set(rel, file.content);
  }
  return wanted;
};

const writeAtomically = async (safeRoot: SafeFileRoot, rel: string, content: string) => {
  const absolutePath = (await safeRoot.resolveForWrite(rel)).operationPath;
  const tmpPath = (await safeRoot.resolveForWrite(`${rel}.${process.pid}.${syncTmpCounter++}.tmp`)).operationPath;
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, absolutePath);
};

/**
 * Write `files` under `dir` and prune files from an earlier sync, touching only files Prompt Studio owns:
 * files it wrote whose content is unchanged since. Every other file is kept and passed to `onKeptFile`.
 */
export const syncWorkspaceDir = async (input: {
  safeRoot: SafeFileRoot;
  stateMount: ArtifactMount;
  dir: string;
  files: WorkspaceSyncFile[];
  onKeptFile?: (file: KeptWorkspaceFile) => void;
}) => {
  const { safeRoot, stateMount, onKeptFile } = input;
  const dir = normalizeMountRelativePath(input.dir);
  const { stateFile, owned } = await readWorkspaceSyncState(stateMount, dir);
  const wanted = resolveWantedFiles(dir, input.files);

  const managed: ManagedFile[] = [];
  for (const [path, content] of wanted) {
    const sha256 = hashContent(content);
    const currentHash = await readCurrentHash(safeRoot, path);
    if (currentHash !== undefined && currentHash !== sha256 && !isUnedited(owned, path, currentHash)) {
      onKeptFile?.({ path, reason: owned.has(path) ? "edited" : "unmanaged" });
      continue;
    }
    if (currentHash !== sha256) await writeAtomically(safeRoot, path, content);
    managed.push({ path, sha256 });
  }

  for (const path of owned.keys()) {
    if (wanted.has(path)) continue;
    const currentHash = await readCurrentHash(safeRoot, path);
    if (currentHash === undefined) continue;
    if (isUnedited(owned, path, currentHash)) {
      await rm((await safeRoot.resolveExisting(path)).operationPath, { force: true });
    } else {
      onKeptFile?.({ path, reason: "edited" });
    }
  }

  const state: WorkspaceSyncState = {
    version: 1,
    dir,
    files: managed.sort((a, b) => a.path.localeCompare(b.path)),
  };
  await stateMount.writeText(stateFile, `${JSON.stringify(state)}\n`);
};
