import { chmod, lstat, mkdtemp, realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import type { RecoveryChunk } from "./chunks";
import { type RecoveryChunkStore, readRecoveryManifest } from "./manifest";
import { publishRecoveryStaging } from "./publish-posix";
import { RecoveryRestoreError } from "./restore-error";
import { planRecoveryRestore } from "./restore-plan";
import { createRecoveryStagingJournal, removeRecoveryStaging, verifyRecoveryStaging } from "./restore-staging";
import { type RecoveryRestoreProgress, writeRecoveryEntries } from "./restore-write";

const code = (error: unknown) => (error as NodeJS.ErrnoException).code;
const nameBytes = 255;
// The longest path the platform accepts, including its terminating byte.
const pathBytes = process.platform === "darwin" ? 1024 : 4096;
const stagingPrefix = ".pstdio-restore-";
const stagingBytes = Buffer.byteLength(`/${stagingPrefix}XXXXXX`);
const tooLong = (path: string | null) =>
  new RecoveryRestoreError(
    "destination_too_long",
    path === null
      ? "This folder name is longer than this disk allows. Choose a shorter name."
      : "A restored path would be longer than this platform allows. Choose a folder closer to the root of the disk.",
    path,
  );

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
  if (Buffer.byteLength(name) > nameBytes) throw tooLong(null);
  let parent: string;
  try {
    parent = await realpath(dirname(path));
  } catch (error) {
    if (code(error) === "ENAMETOOLONG") throw tooLong("");
    throw new RecoveryRestoreError("destination_parent_missing", "Create the new folder's parent folder first");
  }
  const parentStat = await stat(parent, { bigint: true });
  if (!parentStat.isDirectory())
    throw new RecoveryRestoreError("destination_parent_missing", "The new folder's parent is not a folder");
  const destination = join(parent, name);
  const existing = await lstat(destination).catch((error) => {
    if (code(error) === "ENOENT") return null;
    if (code(error) === "ENAMETOOLONG") throw tooLong("");
    throw error;
  });
  if (existing)
    throw new RecoveryRestoreError(
      "destination_exists",
      "This folder already exists. Choose a new folder; to use existing files, attach the folder instead.",
    );
  return { parent, name, destination, identity: { dev: parentStat.dev, ino: parentStat.ino } };
};

/** Both the staging folder and the destination must hold the longest restored path. */
const checkPathLimit = (parent: string, destination: string, longest: string) => {
  const base = Math.max(Buffer.byteLength(destination), Buffer.byteLength(parent) + stagingBytes);
  const entry = longest ? Buffer.byteLength(longest) + 1 : 0;
  if (base + entry >= pathBytes) throw tooLong(longest);
};

const publish = async (target: Awaited<ReturnType<typeof checkRecoveryDestination>>, staging: string) => {
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
      throw new RecoveryRestoreError("unsupported", "This filesystem cannot publish a folder without replacing", null, {
        cause: error,
      });
    throw error;
  }
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
  progress?: (progress: RecoveryRestoreProgress) => void | Promise<void>;
}) => {
  const target = await checkRecoveryDestination(input.destination);
  const manifest = await readRecoveryManifest(input.chunks, input.root);
  const plan = await planRecoveryRestore(input.chunks, input.root, manifest, input.signal);
  checkPathLimit(target.parent, target.destination, plan.longest);
  await input.progress?.({ files: 0, bytes: 0, totalFiles: plan.files, totalBytes: plan.bytes });
  const journal = createRecoveryStagingJournal(input.workRoot);
  await journal.clean();
  const staging = await mkdtemp(join(target.parent, stagingPrefix));
  let recorded: Awaited<ReturnType<typeof journal.record>> | undefined;
  try {
    recorded = await journal.record(staging);
    const written = await writeRecoveryEntries({ ...input, plan, staging, destination: target.destination });
    await verifyRecoveryStaging(staging, plan.expected, input.signal);
    // Directory modes apply last, deepest first, so read-only folders could still be filled.
    for (const { path, mode } of [...plan.directories].reverse()) await chmod(join(staging, path), mode);
    await chmod(staging, plan.rootMode);
    input.signal?.throwIfAborted();
    await publish(target, staging);
    await recorded.done();
    // A link left out means the copy no longer holds a complete repository.
    const git =
      written.omitted.length && manifest.capture.git.state === "functional" ? "incomplete" : manifest.capture.git.state;
    return { path: target.destination, git, ...written };
  } catch (error) {
    // A staging folder that cannot be removed now stays journaled for a later cleanup.
    const removed = await removeRecoveryStaging(staging).then(
      () => true,
      () => false,
    );
    if (removed) await recorded?.done();
    else recorded?.release();
    throw error;
  }
};
