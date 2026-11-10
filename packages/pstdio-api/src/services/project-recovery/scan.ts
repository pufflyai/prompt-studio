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
import { type createRecoveryChunkStore, type RecoveryChunk, recoveryChunkBytes } from "./chunks";
import type { createRecoveryFileCache } from "./file-cache";
import { createRecoveryPages } from "./pages";
import { createRecoveryPolicy } from "./policy";
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
const pointerBytes = 64n * 1024n;
// Coarse filesystem clocks (HFS+, FAT, network shares) can hide a same-size write
// that lands in the tick after a read. Files that recent are read again next time.
const racyNs = 2_000_000_000n;
const maxPointers = 1024;

export interface RecoveryScanInput {
  root: string;
  chunks: Awaited<ReturnType<typeof createRecoveryChunkStore>>;
  /** A fixed policy for roots outside the project folder; the root `.pstignore` is not read. */
  policy?: { text: string | null };
  /** Small included files whose text the caller validates after the scan, such as Git pointers. */
  pointer?: (path: string) => boolean;
  /** Content of files whose source identity is unchanged since an earlier scan. */
  reuse?: ReturnType<typeof createRecoveryFileCache>;
  /** Reports each visited entry with whether the policy included it. */
  visited?: (path: string, included: boolean, kind: "file" | "directory" | "other") => void;
  /** The validated real path; a root that resolves elsewhere is refused before any read. */
  expectedRoot?: string;
  signal?: AbortSignal;
  progress?: (event: { kind: "read"; path: string; files: number; bytes: number }) => Promise<void> | void;
}

/** A scan produces verified encrypted roots, never a published Cloud manifest.
 * The transfer owner must acknowledge the complete graph before publishing it. */
export const scanRecoveryRoot = async (input: RecoveryScanInput) => {
  const startedAt = new Date().toISOString();
  const reusableBefore = BigInt(Date.now()) * 1_000_000n - racyNs;
  const source = await openRecoverySource(input.root);
  if (input.expectedRoot !== undefined && source.rootPath !== input.expectedRoot) {
    source.close();
    throw new RecoveryCaptureError("", new Error("The recovery root moved before capture"));
  }
  const pages = createRecoveryPages(input.chunks);
  const inventory = pages.inventory();
  const excluded = pages.excluded();
  // Validation metadata is paged and encrypted too; no project-sized path array
  // or plaintext path journal remains in the local recovery cache.
  const observations = pages.observations();
  const pointers: { path: string; text: string | null }[] = [];
  let files = 0;
  let bytes = 0;
  const check = () => input.signal?.throwIfAborted();
  const observe = (path: string, stat: BigIntStats) =>
    observations.add({ path, identity: recoverySourceIdentity(stat) });
  const pointerBuffer = (path: string, size: bigint) => {
    if (!input.pointer?.(path)) return undefined;
    return size <= pointerBytes ? new Uint8Array(Number(size)) : null;
  };
  const retainPointer = (path: string, kept: Uint8Array | null) => {
    if (pointers.length >= maxPointers) throw new Error("This folder has more Git pointers than recovery supports");
    let text: string | null = null;
    try {
      if (kept) text = new TextDecoder("utf-8", { fatal: true }).decode(kept);
    } catch {}
    pointers.push({ path, text });
  };
  const reused = async (path: string, initial: BigIntStats) => {
    if (!input.reuse || input.pointer?.(path)) return false;
    const cached = await input.reuse.get(path, recoverySourceIdentity(initial));
    if (!cached || cached.size !== Number(initial.size)) return false;
    await inventory.add({ kind: "file", path, mode: mode(initial), ...cached });
    files++;
    bytes += cached.size;
    return true;
  };
  const remember = async (
    path: string,
    initial: BigIntStats,
    content: { size: number; sha256: string; content: RecoveryChunk | null },
  ) => {
    if (initial.mtimeNs < reusableBefore && initial.ctimeNs < reusableBefore)
      await input.reuse?.set(path, recoverySourceIdentity(initial), content);
  };
  const captureFile = async (parent: RecoverySourceHandle, name: string, path: string, initial: BigIntStats) => {
    const file = await parent.open(name, true);
    try {
      if (!unchangedRecoverySource(await file.stat(), recoverySourceIdentity(initial)))
        throw new Error("The included file changed before capture");
      if (initial.size > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error("This included file exceeds supported offsets");
      if (await reused(path, initial)) return;
      const parts = pages.file();
      const kept = pointerBuffer(path, initial.size);
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
        kept?.set(chunk, position - count);
        await parts.add(await input.chunks.stage(chunk));
        bytes += count;
        await input.progress?.({ kind: "read", path, files, bytes });
      }
      if (
        position !== Number(initial.size) ||
        !unchangedRecoverySource(await file.stat(), recoverySourceIdentity(initial))
      )
        throw new Error("The included file changed during capture");
      const content = { size: position, sha256: digest.digest("hex"), content: await parts.finish() };
      await inventory.add({ kind: "file", path, mode: mode(initial), ...content });
      await remember(path, initial, content);
      files++;
      if (kept !== undefined) retainPointer(path, kept);
    } finally {
      file.close();
    }
  };
  try {
    const cache = await realpath(input.chunks.root);
    if (within(source.rootPath, cache) || within(cache, source.rootPath))
      throw new Error("Recovery working storage must be outside the captured folder");
    check();
    const policy = input.policy ? createRecoveryPolicy(input.policy.text) : await sourceRecoveryPolicy(source.root);
    const rootStat = await source.root.stat();
    await observe("", rootStat);
    const captureEntry = async (directory: RecoverySourceHandle, name: string, path: string) => {
      const entry = await directory.open(name);
      try {
        const stat = await entry.stat();
        const match = policy.classify(path, stat.isDirectory());
        let kind: "file" | "directory" | "other" = "other";
        if (stat.isFile()) kind = "file";
        else if (stat.isDirectory()) kind = "directory";
        input.visited?.(path, match.included, kind);
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
    if (!input.policy && (await sourceRecoveryPolicy(source.root)).text !== policy.text)
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
      rootPath: source.rootPath,
      pointers,
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
