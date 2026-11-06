import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { scanRecoveryRoot } from "./scan";
import { openRecoverySource } from "./source-posix";

type Scan = Awaited<ReturnType<typeof scanRecoveryRoot>>;
type DependencyKind = "git-admin" | "git-common" | "git-objects";
export type RecoveryGitProblem = {
  path: string;
  reason: "excluded" | "unregistered" | "relationship" | "unavailable" | "unsupported";
};
type Pointer = {
  path: string;
  text: string | null;
  base: string;
  origin: string;
  kind: "gitdir" | "commondir" | "alternates";
};

const maxDependencies = 64;
const maxProblems = 64;
const within = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
};
const gitComponent = /(^|\/)\.git(\/|$)/;
const projectPointer = (path: string) => {
  if (basename(path) === ".git") return "gitdir" as const;
  if (/(^|\/)\.git\/(.+\/)?commondir$/.test(path)) return "commondir" as const;
  if (/(^|\/)\.git\/(.+\/)?objects\/info\/alternates$/.test(path)) return "alternates" as const;
  return null;
};
const dependencyPointer = (kind: DependencyKind) => (path: string) =>
  path === (kind === "git-objects" ? "info/alternates" : "objects/info/alternates");
export const isRecoveryGitPointer = (path: string) => projectPointer(path) !== null;

const readPointer = async (directory: string, name: string) => {
  const source = await openRecoverySource(directory);
  try {
    if (source.rootPath !== directory) throw new Error("Git administration moved during validation");
    const file = await source.root.open(name, true);
    try {
      const bytes = new Uint8Array(64 * 1024);
      let length = 0;
      while (length < bytes.length) {
        const count = await file.read(bytes.subarray(length), length);
        if (!count) break;
        length += count;
      }
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)).trim();
    } finally {
      file.close();
    }
  } finally {
    source.close();
  }
};
const real = async (path: string) => {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
};

/** Registered repository roots grant read access to their own `.git` administration.
 * A pointer inside the folder never grants access by itself. See PRD 0015. */
const trustedAdministration = async (roots: string[]) => {
  const trusted: { root: string; admin: string }[] = [];
  for (const root of roots) {
    const resolved = await real(root);
    const admin = resolved && (await real(join(resolved, ".git")));
    if (resolved && admin && (await lstat(admin)).isDirectory()) trusted.push({ root: resolved, admin });
  }
  return trusted;
};

/** Validates every external Git pointer against registered roots and scans
 * the referenced administration and object stores as separate private dependencies. */
export const captureRecoveryGitDependencies = async (input: {
  root: string;
  scan: Scan;
  gitRoots: string[];
  found: boolean;
  excluded: string[];
  capture: (root: string, policy: string | null, pointer: (path: string) => boolean) => Promise<Scan>;
  signal?: AbortSignal;
}) => {
  const problems: RecoveryGitProblem[] = [];
  const dependencies: (Pick<Scan, "inventory" | "exclusions" | "rootMode" | "files" | "bytes"> & {
    kind: DependencyKind;
    path: string;
    referencedBy: string;
    policy: string | null;
  })[] = [];
  const problem = (path: string, reason: RecoveryGitProblem["reason"]) => {
    if (problems.length < maxProblems && !problems.some((item) => item.path === path && item.reason === reason))
      problems.push({ path, reason });
  };
  for (const path of input.excluded) problem(path, "excluded");
  const trusted = await trustedAdministration(input.gitRoots);
  const visited = new Set<string>();
  const queue: Pointer[] = [];
  const enqueue = (scan: Scan, base: string, origin: string | null, kind: (path: string) => Pointer["kind"] | null) => {
    for (const pointer of scan.pointers) {
      const pointerKind = kind(pointer.path);
      if (pointerKind) queue.push({ ...pointer, base, origin: origin ?? pointer.path, kind: pointerKind });
    }
  };
  const add = async (kind: DependencyKind, path: string, referencedBy: string) => {
    if (visited.has(path)) return;
    visited.add(path);
    if (dependencies.length >= maxDependencies) return problem(referencedBy, "unsupported");
    if (within(path, input.root) || within(input.root, path)) return problem(referencedBy, "relationship");
    const policy = kind === "git-common" ? "/worktrees/\n" : null;
    let scan: Scan;
    try {
      scan = await input.capture(path, policy, dependencyPointer(kind));
      if (scan.rootPath !== path) throw new Error("Git administration moved during capture");
    } catch {
      if (input.signal?.aborted) throw input.signal.reason;
      return problem(referencedBy, "unavailable");
    }
    const { inventory, exclusions, rootMode, files, bytes } = scan;
    dependencies.push({ kind, path, referencedBy, policy, inventory, exclusions, rootMode, files, bytes });
    enqueue(scan, path, referencedBy, (pointer) => (dependencyPointer(kind)(pointer) ? "alternates" : null));
  };
  const alternate = async (objects: string, line: string) => {
    if (line.startsWith('"')) return { reason: "unsupported" } as const;
    const target = await real(resolve(objects, line));
    if (!target) return { reason: "unavailable" } as const;
    if (within(input.root, target)) return {};
    if (basename(target) !== "objects" || !trusted.some(({ admin }) => within(admin, target)))
      return { reason: "unregistered" } as const;
    return { target };
  };
  const resolveAlternates = async (pointer: Pointer, text: string) => {
    // Relative alternates are relative to the object directory that owns info/alternates.
    const objects = dirname(dirname(join(pointer.base, pointer.path)));
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || line.startsWith("#")) continue;
      const result = await alternate(objects, line);
      if (result.reason) problem(pointer.origin, result.reason);
      else if (result.target) await add("git-objects", result.target, pointer.origin);
    }
  };
  const resolveWorktree = async (pointer: Pointer, target: string, admin: string) => {
    // The worktree administration must name this exact `.git` file as its checkout,
    // and share the registered repository's common directory.
    const back = await readPointer(target, "gitdir").catch(() => null);
    const checkout = back && (await real(resolve(target, back)));
    const common = await readPointer(target, "commondir").catch(() => null);
    const commonPath = common && (await real(resolve(target, common)));
    if (!checkout || checkout !== (await real(join(pointer.base, pointer.path))) || commonPath !== admin)
      return problem(pointer.origin, "relationship");
    await add("git-admin", target, pointer.origin);
    await add("git-common", admin, pointer.origin);
  };
  const resolveAdministration = async (pointer: Pointer, text: string) => {
    const value = pointer.kind === "gitdir" ? /^gitdir: (.+)$/m.exec(text)?.[1]?.trim() : text.trim();
    if (!value) return problem(pointer.origin, "unsupported");
    const directory = dirname(join(pointer.base, pointer.path));
    const target = await real(resolve(directory, value));
    if (!target) return problem(pointer.origin, "unavailable");
    if (within(input.root, target)) return;
    const owner = trusted.find(({ admin }) => within(admin, target));
    if (!owner) return problem(pointer.origin, "unregistered");
    return linkAdministration(pointer, directory, target, owner);
  };
  const linkAdministration = async (
    pointer: Pointer,
    directory: string,
    target: string,
    owner: { root: string; admin: string },
  ) => {
    if (pointer.kind === "commondir")
      return target === owner.admin
        ? add("git-common", target, pointer.origin)
        : problem(pointer.origin, "relationship");
    const [area, name, ...rest] = relative(owner.admin, target).split(sep);
    if (area === "worktrees" && name && !rest.length) return resolveWorktree(pointer, target, owner.admin);
    // A submodule checkout must live inside the registered repository that owns its module.
    if (area === "modules" && name && within(owner.root, (await real(directory)) ?? ""))
      return add("git-admin", target, pointer.origin);
    problem(pointer.origin, "relationship");
  };
  enqueue(input.scan, input.root, null, projectPointer);
  while (queue.length) {
    input.signal?.throwIfAborted();
    const pointer = queue.shift()!;
    if (pointer.text === null) problem(pointer.origin, "unsupported");
    else if (pointer.kind === "alternates") await resolveAlternates(pointer, pointer.text);
    else await resolveAdministration(pointer, pointer.text);
  }
  let state: "none" | "functional" | "incomplete" = problems.length ? "incomplete" : "functional";
  if (!input.found && !input.excluded.length) state = "none";
  return { state, dependencies, problems };
};

export const isRecoveryGitPath = (path: string) => gitComponent.test(path);
export const isRecoveryGitAdministration = (path: string) => basename(path) === ".git";
