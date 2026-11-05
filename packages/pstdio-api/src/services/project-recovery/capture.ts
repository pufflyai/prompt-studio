import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";
import {
  recoverySourceIdentity,
  sourceRecoveryPolicy,
  unchangedRecoverySource,
  verifyRecoverySource,
} from "./capture-source";
import { type createRecoveryChunkStore, recoveryChunkBytes } from "./chunks";
import { createRecoveryPages } from "./pages";
import { openRecoverySource, type RecoverySourceHandle } from "./source-posix";

export class RecoveryCaptureError extends Error {
  readonly code = "recovery_capture_incomplete";
  constructor(
    readonly path: string,
    cause: unknown,
  ) {
    super("An included recovery entry is incomplete. Resolve its source error and capture again.", { cause });
    this.name = "RecoveryCaptureError";
  }
}
const within = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
};
const mode = (stat: BigIntStats) => Number(stat.mode & 0o7777n);

/** Capture produces verified encrypted roots, never a published Cloud manifest.
 * The transfer owner must acknowledge the complete graph before publishing it. */
export const captureRecoveryFolder = async (input: {
  root: string;
  chunks: Awaited<ReturnType<typeof createRecoveryChunkStore>>;
  firstEnrollment?: boolean;
  signal?: AbortSignal;
  progress?: (event: { kind: "read"; path: string; files: number; bytes: number }) => Promise<void> | void;
}) => {
  const startedAt = new Date().toISOString();
  const source = await openRecoverySource(input.root);
  const pages = createRecoveryPages(input.chunks);
  const inventory = pages.inventory();
  const excluded = pages.excluded();
  // Validation metadata is paged and encrypted too; no project-sized path array
  // or plaintext path journal remains in the local recovery cache.
  const observations = pages.observations();
  let files = 0;
  let bytes = 0;
  const check = () => input.signal?.throwIfAborted();
  const observe = (path: string, stat: BigIntStats) =>
    observations.add({ path, identity: recoverySourceIdentity(stat) });
  const captureFile = async (parent: RecoverySourceHandle, name: string, path: string, initial: BigIntStats) => {
    const file = await parent.open(name, true);
    try {
      if (!unchangedRecoverySource(await file.stat(), recoverySourceIdentity(initial)))
        throw new Error("The included file changed before capture");
      if (initial.size > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error("This included file exceeds supported offsets");
      const parts = pages.file();
      const digest = createHash("sha256");
      const buffer = new Uint8Array(recoveryChunkBytes);
      let position = 0;
      while (true) {
        check();
        const count = await file.read(buffer, position);
        if (!count) break;
        position += count;
        if (position > Number(initial.size)) throw new Error("The included file grew during capture");
        const chunk = buffer.subarray(0, count);
        digest.update(chunk);
        await parts.add(await input.chunks.stage(chunk));
        bytes += count;
        await input.progress?.({ kind: "read", path, files, bytes });
      }
      if (
        position !== Number(initial.size) ||
        !unchangedRecoverySource(await file.stat(), recoverySourceIdentity(initial))
      )
        throw new Error("The included file changed during capture");
      await inventory.add({
        kind: "file",
        path,
        mode: mode(initial),
        size: position,
        sha256: digest.digest("hex"),
        content: await parts.finish(),
      });
      files++;
    } finally {
      file.close();
    }
  };
  try {
    const cache = await realpath(input.chunks.root);
    if (within(source.rootPath, cache) || within(cache, source.rootPath))
      throw new Error("Recovery working storage must be outside the captured folder");
    check();
    const policy = await sourceRecoveryPolicy(source.root, input.firstEnrollment ?? false, input.chunks.directory);
    const rootStat = await source.root.stat();
    await observe("", rootStat);
    const captureEntry = async (directory: RecoverySourceHandle, name: string, path: string) => {
      const entry = await directory.open(name);
      try {
        const stat = await entry.stat();
        const match = policy.classify(path, stat.isDirectory());
        if (!match.included) {
          await excluded.add({ path, rule: match.rule! });
          return;
        }
        await observe(path, stat);
        if (stat.isFile()) await captureFile(directory, name, path, stat);
        else if (stat.isSymbolicLink()) {
          const target = directory.readlink(name);
          await verifyRecoverySource(source.root, path, recoverySourceIdentity(stat));
          await inventory.add({ kind: "symlink", path, mode: mode(stat), target });
        } else if (stat.isDirectory()) {
          await inventory.add({ kind: "directory", path, mode: mode(stat) });
          const opened = await directory.open(name, true);
          try {
            if (!unchangedRecoverySource(await opened.stat(), recoverySourceIdentity(stat)))
              throw new Error("An included directory changed before capture");
            await scan(opened, path);
          } finally {
            opened.close();
          }
        } else throw new Error("This included filesystem entry type cannot be recovered");
      } finally {
        entry.close();
      }
    };
    const scan = async (directory: RecoverySourceHandle, prefix: string) => {
      for (const name of directory.children()) {
        check();
        const path = prefix ? `${prefix}/${name}` : name;
        try {
          await captureEntry(directory, name, path);
        } catch (error) {
          if (input.signal?.aborted) throw input.signal.reason;
          if (error instanceof RecoveryCaptureError) throw error;
          throw new RecoveryCaptureError(path, error);
        }
      }
    };
    await scan(source.root, "");
    const validation = await observations.finish();
    for await (const observation of pages.observed(validation)) {
      check();
      try {
        await verifyRecoverySource(source.root, observation.path, observation.identity);
      } catch (error) {
        throw new RecoveryCaptureError(observation.path, error);
      }
    }
    if ((await sourceRecoveryPolicy(source.root, false)).text !== policy.text)
      throw new RecoveryCaptureError(".pstignore", new Error("The applied recovery policy changed"));
    const currentRoot = await openRecoverySource(input.root);
    try {
      if (
        currentRoot.rootPath !== source.rootPath ||
        !unchangedRecoverySource(await currentRoot.root.stat(), recoverySourceIdentity(rootStat))
      )
        throw new RecoveryCaptureError("", new Error("The selected recovery folder changed"));
    } finally {
      currentRoot.close();
    }
    return {
      inventory: await inventory.finish(),
      exclusions: await excluded.finish(),
      policy: policy.text,
      rootMode: mode(rootStat),
      files,
      bytes,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  } finally {
    source.close();
  }
};
