import { createHash } from "node:crypto";
import { chmod, type FileHandle, lstat, mkdir, mkdtemp, open, realpath, stat, symlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import type { RecoveryChunk } from "./chunks";
import { type RecoveryChunkStore, readRecoveryManifest } from "./manifest";
import { createRecoveryPages, type RecoveryEntry } from "./pages";
import { publishRecoveryStaging } from "./publish-posix";
import { RecoveryRestoreError } from "./restore-error";
import { createRecoveryGitLinks } from "./restore-git";
import { planRecoveryRestore, type RecoveryRestorePlan, type RestoreRoot } from "./restore-plan";
import { createRecoveryStagingJournal, removeRecoveryStaging, verifyRecoveryStaging } from "./restore-staging";


const code = (error: unknown) => (error as NodeJS.ErrnoException).code;
const within = (root: string, path: string) => path === root || path.startsWith(`${root}/`);

/**
 * The destination must not exist, not even as an empty folder or a link, and its parent
 * must. Nothing is written when it is refused.
 */
export const checkRecoveryDestination = async (path: string) => {
  if (process.platform !== "darwin" && process.platform !== "linux")
    throw new RecoveryRestoreError("unsupported", "Restoring a folder is not supported on this platform yet");
  const name = basename(path);
  if (!isAbsolute(path) || !name || name === "." || name === "..")
    throw new RecoveryRestoreError("destination_parent_missing", "Choose an absolute path for the new folder");
  let parent: string;
  try {
    parent = await realpath(dirname(path));
  } catch {
    throw new RecoveryRestoreError("destination_parent_missing", "Create the new folder's parent folder first");
  }
  const parentStat = await stat(parent, { bigint: true });
  if (!parentStat.isDirectory())
    throw new RecoveryRestoreError("destination_parent_missing", "The new folder's parent is not a folder");
  const destination = join(parent, name);
  const existing = await lstat(destination).catch((error) => {
    if (code(error) === "ENOENT") return null;
    throw error;
  });
  if (existing)
    throw new RecoveryRestoreError(
      "destination_exists",
      "This folder already exists. Choose a new folder; to use existing files, attach the folder instead.",
    );
  return { parent, name, destination, identity: { dev: parentStat.dev, ino: parentStat.ino } };
};

const layoutFor = (layout: string[], prefix: string) =>
  prefix ? layout.filter((path) => within(path, prefix) || dirname(path) === prefix) : [];

interface Progress {
  files: number;
  bytes: number;
  totalFiles: number;
  totalBytes: number;
}

const writeEntries = async (input: {
  chunks: RecoveryChunkStore;
  plan: RecoveryRestorePlan;
  staging: string;
  destination: string;
  signal?: AbortSignal;
  progress?: (progress: Progress) => void | Promise<void>;
}) => {
  const pages = createRecoveryPages(input.chunks);
  const links = createRecoveryGitLinks({ destination: input.destination, roots: input.plan.roots });
  const rewritten: string[] = [];
  const done = { files: 0, bytes: 0, totalFiles: input.plan.files, totalBytes: input.plan.bytes };
  const collision = (error: unknown, path: string) => {
    if (code(error) !== "EEXIST") return error;
    return new RecoveryRestoreError("name_collision", "Two entries in the copy name the same file on this disk", path);
  };
  const created = new Set<string>();
  const directory = async (path: string) => {
    await mkdir(join(input.staging, path), { mode: 0o700 }).catch((error) => {
      throw collision(error, path);
    });
    created.add(path);
  };
  /** Verified plaintext goes to the file, or into `keep` when Git links may need rebuilding. */
  const copyParts = async (
    file: FileHandle,
    entry: Extract<RecoveryEntry, { kind: "file" }>,
    path: string,
    keep: Uint8Array | null,
  ) => {
    const hash = createHash("sha256");
    let size = 0;
    for await (const reference of pages.parts(entry.content)) {
      input.signal?.throwIfAborted();
      const part = await input.chunks.read(reference);
      if (size + part.length > entry.size)
        throw new RecoveryRestoreError("integrity", "A file in the copy is larger than recorded", path);
      hash.update(part);
      if (keep) keep.set(part, size);
      else await file.write(part, 0, part.length, size);
      size += part.length;
      done.bytes += part.length;
      await input.progress?.(done);
    }
    if (size !== entry.size || hash.digest("hex") !== entry.sha256)
      throw new RecoveryRestoreError("integrity", "A file in the copy failed verification. Download it again.", path);
  };
  const writeFile = async (root: RestoreRoot, entry: Extract<RecoveryEntry, { kind: "file" }>, path: string) => {
    const file = await open(join(input.staging, path), "wx", 0o600).catch((error) => {
      throw collision(error, path);
    });
    try {
      const keep = links.candidate(root, entry.path, entry.size) ? new Uint8Array(entry.size) : null;
      await copyParts(file, entry, path, keep);
      if (keep) {
        const relinked = links.rewrite(root, entry.path, keep);
        if (relinked) {
          rewritten.push(path);
          input.plan.expected.set(path, { kind: "file", mode: entry.mode, size: relinked.length });
        }
        const bytes = relinked ?? keep;
        await file.write(bytes, 0, bytes.length, 0);
      }
      await file.chmod(entry.mode);
      await file.sync();
    } finally {
      await file.close();
    }
    done.files++;
    await input.progress?.(done);
  };
  for (const root of input.plan.roots) {
    // Layout directories for rebuilt Git administration come before each dependency root.
    for (const path of layoutFor(input.plan.layout, root.prefix)) if (!created.has(path)) await directory(path);
    for await (const entry of pages.entries(root.inventory)) {
      input.signal?.throwIfAborted();
      const path = root.prefix ? `${root.prefix}/${entry.path}` : entry.path;
      if (entry.kind === "directory") await directory(path);
      else if (entry.kind === "file") await writeFile(root, entry, path);
      else
        await symlink(entry.target, join(input.staging, path)).catch((error) => {
          throw collision(error, path);
        });
    }
  }
  return rewritten;
};

/**
 * Restores one completed capture from the local recovery store into an absent folder.
 * The copy is validated whole, written into a private sibling staging folder, verified
 * against the plan and only then published with a rename that refuses an existing
 * destination. Failure or cancellation removes the staging folder and nothing else.
 */
export const restoreRecoveryCapture = async (input: {
  chunks: RecoveryChunkStore;
  root: RecoveryChunk;
  destination: string;
  /** Recovery working storage, for the staging journal. */
  workRoot: string;
  signal?: AbortSignal;
  progress?: (progress: Progress) => void | Promise<void>;
}) => {
  const target = await checkRecoveryDestination(input.destination);
  const manifest = await readRecoveryManifest(input.chunks, input.root);
  const plan = await planRecoveryRestore(input.chunks, manifest, input.signal);
  await input.progress?.({ files: 0, bytes: 0, totalFiles: plan.files, totalBytes: plan.bytes });
  const journal = createRecoveryStagingJournal(input.workRoot);
  await journal.clean();
  const staging = await mkdtemp(join(target.parent, `.${target.name}.pstdio-restore-`));
  let recorded: Awaited<ReturnType<typeof journal.record>> | undefined;
  try {
    recorded = await journal.record(staging);
    const rewritten = await writeEntries({ ...input, plan, staging, destination: target.destination });
    await verifyRecoveryStaging(staging, plan.expected, input.signal);
    // Directory modes apply last, deepest first, so read-only folders could still be filled.
    for (const { path, mode } of [...plan.directories].reverse()) await chmod(join(staging, path), mode);
    await chmod(staging, plan.rootMode);
    input.signal?.throwIfAborted();
    try {
      await publishRecoveryStaging({
        parent: target.parent,
        identity: target.identity,
        from: basename(staging),
        to: target.name,
      });
    } catch (error) {
      if (code(error) === "EEXIST" || code(error) === "ENOTEMPTY")
        throw new RecoveryRestoreError(
          "destination_created",
          "Another program created this folder during the restore. It was kept unchanged; choose a new folder.",
        );
      if (code(error) === "ENOTSUP" || code(error) === "EINVAL" || code(error) === "ENOSYS")
        throw new RecoveryRestoreError(
          "unsupported",
          "This filesystem cannot publish a folder without replacing",
          null,
          {
            cause: error,
          },
        );
      throw error;
    }
    return { path: target.destination, git: manifest.capture.git.state, rewritten };
  } catch (error) {
    await removeRecoveryStaging(staging);
    throw error;
  } finally {
    await recorded?.done();
  }
};
