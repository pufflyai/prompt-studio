import { createHash } from "node:crypto";
import type { RecoveryChunk } from "./chunks";
import type { RecoveryChunkStore, RecoveryManifest } from "./manifest";
import { createRecoveryPages, type RecoveryEntry } from "./pages";
import { RecoveryRestoreError } from "./restore-error";

type Dependency = RecoveryManifest["capture"]["git"]["dependencies"][number];
export interface RestoreRoot {
  inventory: RecoveryChunk;
  /** Where the root's entries go, relative to the restored folder. Empty for the folder itself. */
  prefix: string;
  /** The root's absolute path on the source device, to rebuild Git links. */
  source: string;
  mode: number;
}
export type RestoreExpected =
  | { kind: "directory"; mode: number }
  | { kind: "file"; mode: number; size: number }
  | { kind: "symlink"; target: string };

/** External Git administration is rebuilt inside the restored folder, so the folder never
 * depends on paths of the source device. This Prompt Studio-owned location is reserved. */
const recoveryGitLayout = ".pstdio/recovery/git";
const nameBytes = 255;
const join = (prefix: string, path: string) => (prefix ? `${prefix}/${path}` : path);
const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")));
const within = (root: string, path: string) => path === root || path.startsWith(`${root}/`);

/** A linked worktree's administration goes back under its common directory's `worktrees/`,
 * so Git's own relative `commondir` link stays valid. Other roots get their own slot. */
const dependencyLayout = (dependencies: Dependency[]) => {
  const prefixes = new Map<Dependency, string>();
  const common = dependencies.filter((dependency) => dependency.kind === "git-common");
  const ordered = [...common, ...dependencies.filter((dependency) => dependency.kind !== "git-common")];
  const synthetic: string[] = [];
  for (const [index, dependency] of ordered.entries()) {
    const owner = common.find(
      (root) => dependency.kind === "git-admin" && parentOf(dependency.path) === `${root.path}/worktrees`,
    );
    if (!owner) {
      prefixes.set(dependency, `${recoveryGitLayout}/${index}`);
      continue;
    }
    const worktrees = `${prefixes.get(owner)}/worktrees`;
    if (!synthetic.includes(worktrees)) synthetic.push(worktrees);
    prefixes.set(dependency, `${worktrees}/${dependency.path.slice(dependency.path.lastIndexOf("/") + 1)}`);
  }
  return { ordered, prefixes, synthetic };
};

const unsafe = (path: string, message: string) => new RecoveryRestoreError("unsafe_entry", message, path);
const reserved = (path: string) =>
  new RecoveryRestoreError("name_collision", "The copy uses a name this restore reserves", path);

/** The entries a restore must produce, keyed by their path in the restored folder. */
const createPlanEntries = (dependencies: boolean) => {
  const expected = new Map<string, RestoreExpected>();
  const directories: { path: string; mode: number }[] = [];
  /** Directories the restore adds for rebuilt Git administration, in creation order. */
  const layout: string[] = [];
  const directory = (path: string, mode: number) => {
    expected.set(path, { kind: "directory", mode });
    directories.push({ path, mode });
  };
  const addLayout = (path: string, mode: number) => {
    directory(path, mode);
    layout.push(path);
  };
  let files = 0;
  let bytes = 0;
  return {
    expected,
    directories,
    layout,
    totals: () => ({ files, bytes }),
    /** A dependency root and the layout directories above and inside it. */
    root(prefix: string, mode: number, synthetic: string[]) {
      const parts = prefix.split("/");
      for (let index = 1; index < parts.length; index++) {
        const path = parts.slice(0, index).join("/");
        const existing = expected.get(path);
        if (existing && existing.kind !== "directory") throw reserved(path);
        if (!existing) addLayout(path, 0o755);
      }
      if (expected.has(prefix)) throw reserved(prefix);
      addLayout(prefix, mode);
      for (const path of synthetic) if (parentOf(path) === prefix) addLayout(path, 0o755);
    },
    entry(root: RestoreRoot, entry: RecoveryEntry) {
      const path = join(root.prefix, entry.path);
      if (!root.prefix && dependencies && within(recoveryGitLayout, path)) throw reserved(path);
      if (entry.path.split("/").some((part) => Buffer.byteLength(part) > nameBytes))
        throw unsafe(path, "A name in the copy is longer than this filesystem allows");
      if (expected.has(path)) throw unsafe(path, "The copy lists this path twice");
      const parent = parentOf(path);
      if (parent !== root.prefix && expected.get(parent)?.kind !== "directory")
        throw unsafe(path, "The copy places this entry outside a directory it restores");
      if (entry.kind === "directory") return directory(path, entry.mode);
      if (entry.kind === "symlink") return expected.set(path, { kind: "symlink", target: entry.target });
      expected.set(path, { kind: "file", mode: entry.mode, size: entry.size });
      files++;
      bytes += entry.size;
      if (!Number.isSafeInteger(bytes)) throw unsafe(path, "The copy exceeds supported sizes");
    },
  };
};

/**
 * Validates the whole manifest before anything is written: every path is relative and
 * stays below a directory the manifest itself creates, so no write can pass through a
 * restored link or outside the folder. Exact duplicates are refused here; names that
 * collide only on the destination filesystem are refused when staging creates them.
 */
export const planRecoveryRestore = async (
  chunks: RecoveryChunkStore,
  manifest: RecoveryManifest,
  signal?: AbortSignal,
) => {
  const pages = createRecoveryPages(chunks);
  const { capture, source } = manifest;
  const layout = dependencyLayout(capture.git.dependencies);
  const roots: RestoreRoot[] = [
    { inventory: capture.inventory, prefix: "", source: source.folder, mode: capture.rootMode },
    ...layout.ordered.map((dependency) => ({
      inventory: dependency.inventory,
      prefix: layout.prefixes.get(dependency)!,
      source: dependency.path,
      mode: dependency.rootMode,
    })),
  ];
  const plan = createPlanEntries(capture.git.dependencies.length > 0);
  const policy = capture.policy === null ? null : createHash("sha256").update(capture.policy).digest("hex");
  let policyFound = false;
  for (const root of roots) {
    if (root.prefix) plan.root(root.prefix, root.mode, layout.synthetic);
    for await (const entry of pages.entries(root.inventory)) {
      signal?.throwIfAborted();
      plan.entry(root, entry);
      if (root.prefix || entry.path !== ".pstignore") continue;
      policyFound = entry.kind === "file" && entry.sha256 === policy;
      if (!policyFound) throw unsafe(entry.path, "The copy's policy file does not match it");
    }
  }
  if (policyFound !== (policy !== null)) throw unsafe(".pstignore", "The copy's policy file does not match it");
  const { files, bytes } = plan.totals();
  const counted = capture.git.dependencies.reduce(
    (sum, item) => ({ files: sum.files + item.files, bytes: sum.bytes + item.bytes }),
    { files: capture.files, bytes: capture.bytes },
  );
  if (files !== counted.files || bytes !== counted.bytes)
    throw new RecoveryRestoreError("integrity", "The copy's entries do not match its counts", null);
  const { expected, directories } = plan;
  return { roots, expected, directories, layout: plan.layout, files, bytes, rootMode: capture.rootMode };
};
export type RecoveryRestorePlan = Awaited<ReturnType<typeof planRecoveryRestore>>;
