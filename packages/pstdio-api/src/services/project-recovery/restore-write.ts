import { createHash } from "node:crypto";
import { mkdir, open, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RecoveryChunkStore } from "./manifest";
import { createRecoveryPages, type RecoveryEntry } from "./pages";
import { RecoveryRestoreError } from "./restore-error";
import { createRecoveryGitLinks, type RecoveryOmission } from "./restore-git";
import type { RecoveryRestorePlan, RestoreRoot } from "./restore-plan";

type FileEntry = Extract<RecoveryEntry, { kind: "file" }>;
export interface RecoveryRestoreProgress {
  files: number;
  bytes: number;
  totalFiles: number;
  totalBytes: number;
}

const code = (error: unknown) => (error as NodeJS.ErrnoException).code;
const within = (root: string, path: string) => path === root || path.startsWith(`${root}/`);
const layoutFor = (layout: string[], prefix: string) =>
  prefix ? layout.filter((path) => within(path, prefix) || dirname(path) === prefix) : [];
const collision = (error: unknown, path: string) => {
  if (code(error) !== "EEXIST") return error;
  return new RecoveryRestoreError("name_collision", "Two entries in the copy name the same file on this disk", path);
};

/**
 * Writes the planned entries into the staging folder. Every entry is created exclusively
 * below a directory this restore made, so nothing is written through a restored link.
 * Plaintext is verified against the file digest before it counts as restored.
 */
export const writeRecoveryEntries = async (input: {
  chunks: RecoveryChunkStore;
  plan: RecoveryRestorePlan;
  staging: string;
  destination: string;
  signal?: AbortSignal;
  progress?: (progress: RecoveryRestoreProgress) => void | Promise<void>;
}) => {
  const pages = createRecoveryPages(input.chunks);
  const links = createRecoveryGitLinks({ destination: input.destination, roots: input.plan.roots });
  const rewritten: string[] = [];
  const omitted: RecoveryOmission[] = [];
  const done = { files: 0, bytes: 0, totalFiles: input.plan.files, totalBytes: input.plan.bytes };
  const created = new Set<string>();
  const directory = async (path: string) => {
    await mkdir(join(input.staging, path), { mode: 0o700 }).catch((error) => {
      throw collision(error, path);
    });
    created.add(path);
  };
  const create = async (
    path: string,
    mode: number,
    write: (file: Awaited<ReturnType<typeof open>>) => Promise<void>,
  ) => {
    const file = await open(join(input.staging, path), "wx", 0o600).catch((error) => {
      throw collision(error, path);
    });
    try {
      await write(file);
      await file.chmod(mode & 0o777);
      await file.sync();
    } finally {
      await file.close();
    }
  };
  /** Each verified chunk goes to `sink` in order; the file must match its recorded digest. */
  const copyParts = async (entry: FileEntry, path: string, sink: (part: Uint8Array, at: number) => Promise<void>) => {
    const hash = createHash("sha256");
    let size = 0;
    for await (const reference of pages.parts(entry.content)) {
      input.signal?.throwIfAborted();
      const part = await input.chunks.read(reference);
      if (size + part.length > entry.size)
        throw new RecoveryRestoreError("integrity", "A file in the copy is larger than recorded", path);
      hash.update(part);
      await sink(part, size);
      size += part.length;
      done.bytes += part.length;
      await input.progress?.(done);
    }
    if (size !== entry.size || hash.digest("hex") !== entry.sha256)
      throw new RecoveryRestoreError("integrity", "A file in the copy failed verification. Download it again.", path);
  };
  /** A Git link is read whole, rebuilt for this folder, or left out when it leads elsewhere. */
  const writeLink = async (root: RestoreRoot, entry: FileEntry, path: string) => {
    const keep = new Uint8Array(entry.size);
    await copyParts(entry, path, async (part, at) => keep.set(part, at));
    const result = links.rewrite(root, entry.path, keep);
    // A configuration keeps its other settings after an outside work tree is dropped.
    if (result.omit) omitted.push({ path, reason: result.omit });
    if (!result.bytes) return void input.plan.expected.delete(path);
    if (result.changed) {
      rewritten.push(path);
      input.plan.expected.set(path, { kind: "file", mode: entry.mode & 0o777, size: result.bytes.length });
    }
    const bytes = result.bytes;
    await create(path, entry.mode, async (file) => {
      await file.write(bytes, 0, bytes.length, 0);
    });
  };
  const writeFile = async (root: RestoreRoot, entry: FileEntry, path: string) => {
    const kind = links.classify(root, entry.path, entry.size);
    if (kind === "omit") {
      input.plan.expected.delete(path);
      omitted.push({ path, reason: "git-link-outside-folder" });
    } else if (kind === "read") await writeLink(root, entry, path);
    else
      await create(path, entry.mode, (file) =>
        copyParts(entry, path, async (part, at) => {
          await file.write(part, 0, part.length, at);
        }),
      );
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
  for (const extra of input.plan.extras)
    await create(extra.path, 0o644, async (file) => {
      await file.write(extra.bytes, 0, extra.bytes.length, 0);
    });
  return { rewritten, omitted };
};
