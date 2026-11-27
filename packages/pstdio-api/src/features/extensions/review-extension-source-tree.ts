import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, readlink, symlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, posix, win32 } from "node:path";
import { mergeExtensionReviewFile } from "./review-extension-source-merge";

type ReviewTreeEntry =
  | { kind: "directory"; children: ReviewTree; fingerprint: string }
  | { kind: "link"; target: string; fingerprint: string }
  | { kind: "file"; bytes: Buffer; executable: boolean; fingerprint: string };
type ReviewTree = Map<string, ReviewTreeEntry>;
type ReviewFile = ReviewTreeEntry | undefined;
type ReviewResolution = { kind: "local" | "incoming" } | { kind: "text"; text: string };

export type ExtensionReviewChange = {
  path: string;
  status: "local" | "incoming" | "merged" | "conflict";
  localKind: ReviewTreeEntry["kind"] | null;
  incomingKind: ReviewTreeEntry["kind"] | null;
};

const digest = (pieces: unknown[]) => createHash("sha256").update(JSON.stringify(pieces)).digest("hex");
const folderEntry = (children: ReviewTree): ReviewTreeEntry => ({
  kind: "directory",
  children,
  fingerprint: digest([...children].map(([name, entry]) => [name, entry.fingerprint])),
});

const fileEntry = (bytes: Buffer, executable: boolean): ReviewTreeEntry => ({
  kind: "file",
  bytes,
  executable,
  fingerprint: digest(["file", executable, createHash("sha256").update(bytes).digest("hex")]),
});

export const readExtensionReviewTree = async (root: string, options: { ignoreGit?: boolean } = {}) => {
  if (!(await lstat(root)).isDirectory()) throw new Error("The extension working copy must be a directory.");
  let bytes = 0;
  let entries = 0;
  const readEntry = async (path: string, relative: string, prefix: string): Promise<ReviewTreeEntry> => {
    const stat = await lstat(path);
    if (stat.isDirectory()) return folderEntry(await walk(path, `${relative}/`));
    if (stat.isFile()) {
      bytes += stat.size;
      if (bytes > 128 * 1024 * 1024) throw new Error("This source is too large to stage a review.");
      return fileEntry(await readFile(path), (stat.mode & 0o111) !== 0);
    }
    if (!stat.isSymbolicLink()) throw new Error(`The path ${relative} is not a file, directory, or link.`);
    const target = await readlink(path);
    const destination = posix.normalize(posix.join(prefix, target));
    if (
      isAbsolute(target) ||
      win32.isAbsolute(target) ||
      target.includes("\\") ||
      target.split("/").includes("..") ||
      destination === ".." ||
      destination.startsWith("../")
    )
      throw new Error(`The link ${relative} points outside the source folder.`);
    return { kind: "link", target, fingerprint: digest(["link", target]) };
  };
  const walk = async (directory: string, prefix: string): Promise<ReviewTree> => {
    const result: ReviewTree = new Map();
    const aliases = new Set<string>();
    for (const name of (await readdir(directory)).sort()) {
      if (prefix === "" && (name === "node_modules" || (options.ignoreGit && name === ".git"))) continue;
      const alias = name.normalize("NFD").toLowerCase();
      if (name.includes("\\") || alias === ".git" || aliases.has(alias))
        throw new Error("This source contains paths that cannot be staged safely.");
      const relative = prefix + name;
      if (++entries > 20_000 || relative.length > 4_096) throw new Error("This source is too large to stage a review.");
      aliases.add(alias);
      result.set(name, await readEntry(join(directory, name), relative, prefix));
    }
    return result;
  };
  return walk(root, "");
};

const equalEntries = (a: ReviewFile, b: ReviewFile) => a?.kind === b?.kind && a?.fingerprint === b?.fingerprint;

export const diffExtensionReviewPaths = (before: ReviewTree, after: ReviewTree) => {
  const paths: string[] = [];
  const visit = (original: ReviewTree, current: ReviewTree, prefix: string) => {
    for (const name of [...new Set([...original.keys(), ...current.keys()])].sort()) {
      const previous = original.get(name);
      const next = current.get(name);
      if (equalEntries(previous, next)) continue;
      const path = prefix + name;
      if (previous?.kind === "directory" && next?.kind === "directory")
        visit(previous.children, next.children, `${path}/`);
      else paths.push(path);
    }
  };
  visit(before, after, "");
  return paths;
};

const tryFileMerge = (before: ReviewFile, left: ReviewFile, right: ReviewFile) => {
  if (before?.kind !== "file" || left?.kind !== "file" || right?.kind !== "file") return;
  const merge = mergeExtensionReviewFile(before.bytes, left.bytes, right.bytes);
  if (merge.kind === "conflict") return;
  const executable = left.executable === before.executable ? right.executable : left.executable;
  let bytes = left.bytes;
  if (merge.kind === "take-incoming") bytes = right.bytes;
  if (merge.kind === "merged") bytes = Buffer.from(merge.text);
  return fileEntry(bytes, executable);
};

const chooseResolution = (path: string, left: ReviewFile, right: ReviewFile, resolution: ReviewResolution) => {
  if (resolution.kind === "local") return left;
  if (resolution.kind === "incoming") return right;
  if (resolution.kind !== "text") throw new Error("Unknown extension review resolution.");
  if ((left && left.kind !== "file") || (right && right.kind !== "file"))
    throw new Error(`Only files can have edited text: ${path}`);
  return fileEntry(Buffer.from(resolution.text), left?.executable ?? right?.executable ?? false);
};

export const planExtensionReview = (
  base: ReviewTree | undefined,
  local: ReviewTree,
  incoming: ReviewTree,
  resolutions: ReadonlyMap<string, ReviewResolution> = new Map(),
) => {
  const changes: ExtensionReviewChange[] = [];
  const unresolved = new Set<string>();
  const used = new Set<string>();
  type PlannedEntry = { entry: ReviewFile; status?: ExtensionReviewChange["status"] };

  const choose = (
    path: string,
    original: ReviewTree | undefined,
    before: ReviewFile,
    left: ReviewFile,
    right: ReviewFile,
  ): PlannedEntry => {
    if (equalEntries(left, right)) return { entry: left };
    if (left?.kind === "directory" && right?.kind === "directory" && (!before || before.kind === "directory")) {
      const children = merge(original && (before?.children ?? new Map()), left.children, right.children, `${path}/`);
      return { entry: folderEntry(children) };
    }
    if (original && equalEntries(left, before)) return { entry: right, status: "incoming" };
    if (original && equalEntries(right, before)) return { entry: left, status: "local" };
    const combined = tryFileMerge(before, left, right);
    if (combined) return { entry: combined, status: "merged" };
    const resolution = resolutions.get(path);
    if (!resolution) {
      unresolved.add(path);
      return { entry: left, status: "conflict" };
    }
    used.add(path);
    return { entry: chooseResolution(path, left, right, resolution), status: "conflict" };
  };

  const merge = (
    original: ReviewTree | undefined,
    working: ReviewTree,
    release: ReviewTree,
    prefix: string,
  ): ReviewTree => {
    const result: ReviewTree = new Map();
    const names = new Set([...(original?.keys() ?? []), ...working.keys(), ...release.keys()]);
    for (const name of [...names].sort()) {
      const path = prefix + name;
      const left = working.get(name);
      const right = release.get(name);
      const { entry, status } = choose(path, original, original?.get(name), left, right);
      if (status) changes.push({ path, status, localKind: left?.kind ?? null, incomingKind: right?.kind ?? null });
      if (entry) result.set(name, entry);
    }
    return result;
  };
  const result = merge(base, local, incoming, "");
  if (used.size !== resolutions.size) throw new Error("One or more resolutions refer to a file without a conflict.");
  return { changes, result, unresolved };
};

export const writeExtensionReviewTree = async (root: string, tree: ReviewTree): Promise<void> => {
  await mkdir(root, { mode: 0o700 });
  const aliases = new Set<string>();
  for (const [name, entry] of tree) {
    const alias = name.normalize("NFD").toLowerCase();
    if (aliases.has(alias)) throw new Error(`Selected paths overlap on this filesystem: ${name}`);
    aliases.add(alias);
    const path = join(root, name);
    if (entry.kind === "directory") await writeExtensionReviewTree(path, entry.children);
    else if (entry.kind === "link") await symlink(entry.target, path);
    else await writeFile(path, entry.bytes, { mode: entry.executable ? 0o755 : 0o644, flag: "wx" });
  }
};

const getReviewEntry = (tree: ReviewTree | undefined, path: string) => {
  const names = path.split("/");
  const leaf = names.pop()!;
  let folder = tree;
  for (const name of names) {
    const entry = folder?.get(name);
    folder = entry?.kind === "directory" ? entry.children : undefined;
  }
  return folder?.get(leaf);
};

export const isSameExtensionReviewPath = (before: ReviewTree, after: ReviewTree, path: string) =>
  equalEntries(getReviewEntry(before, path), getReviewEntry(after, path));

export const readExtensionReviewText = (tree: ReviewTree | undefined, path: string) => {
  const entry = getReviewEntry(tree, path);
  if (entry?.kind !== "file" || entry.bytes.byteLength > 1024 * 1024 || entry.bytes.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(entry.bytes);
  } catch {
    return null;
  }
};
